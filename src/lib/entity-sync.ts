/** Utilitaires purs pour les connecteurs d'entités REST et LDAP.
 * Les connecteurs ne créent jamais une entité sans aperçu/validation explicite. */

import { isInternalHostname } from '@/lib/ip-safety'

const MAX_REST_RESPONSE_BYTES = 1_048_576

/** Lit un JSON réseau avec une vraie borne même lorsqu'un serveur omet
 * Content-Length (réponse chunked). */
async function readLimitedJson(response: Response): Promise<unknown> {
  if (!response.body) return response.json() as Promise<unknown>
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_REST_RESPONSE_BYTES) throw new Error('response_too_large')
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const data = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength }
  return JSON.parse(new TextDecoder().decode(data)) as unknown
}

export type EntitySyncConfig = {
  type?: 'REST' | 'LDAP'
  endpoint?: string
  token?: string
  bindDN?: string
  password?: string
  baseDN?: string
  filter?: string
}

/** Fusionne la saisie avec la configuration stockée : un champ secret vide
 * signifie « conserver le secret », jamais « l'effacer silencieusement ». */
export function mergeEntitySyncConfig(existing: EntitySyncConfig, submitted: EntitySyncConfig): EntitySyncConfig {
  const submittedToken = submitted.token?.trim()
  const submittedPassword = submitted.password?.trim()
  return {
    ...submitted,
    // [CONFIGURED] est uniquement une projection publique de l'API ; il ne doit
    // jamais être chiffré ni remplacer un secret existant.
    token: !submittedToken || submittedToken === '[CONFIGURED]' ? existing.token || '' : submittedToken,
    password: !submittedPassword || submittedPassword === '[CONFIGURED]' ? existing.password || '' : submittedPassword,
  }
}

/** Projection sûre pour le navigateur : les secrets ne quittent jamais le serveur. */
export function publicEntitySyncConfig(config: EntitySyncConfig): Required<Omit<EntitySyncConfig, 'type'>> & Pick<EntitySyncConfig, 'type'> {
  return {
    type: config.type,
    endpoint: config.endpoint ?? '',
    token: config.token ? '[CONFIGURED]' : '',
    bindDN: config.bindDN ?? '',
    password: config.password ? '[CONFIGURED]' : '',
    baseDN: config.baseDN ?? '',
    filter: config.filter ?? '',
  }
}

/** Accepte uniquement une URL HTTPS publique (contrôle statique). La résolution DNS
 * est validée au moment de la requête serveur (`safeFetch` REST, `resolvePublicLdap` LDAP). */
export function validateSyncEndpoint(value: string): string | null {
  try {
    const url = new URL(value.trim())
    const hostname = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' || url.username || url.password || !hostname || isInternalHostname(hostname)) return null
    return url.toString()
  } catch { return null }
}

/** Même règle d'exposition réseau que REST, avec LDAPS obligatoire. */
export function validateLdapEndpoint(value: string): string | null {
  try {
    const url = new URL(value.trim())
    const hostname = url.hostname.toLowerCase()
    if (url.protocol !== 'ldaps:' || url.username || url.password || !hostname || isInternalHostname(hostname)) return null
    return url.toString()
  } catch { return null }
}

/** Lit les attributs conventionnels retournés par une API REST ou un LDAP
 * sérialisé, sans dépendre d'un annuaire particulier. */
export function normalizeExternalEntities(rows: unknown): string[] {
  if (!Array.isArray(rows)) return []
  const seen = new Set<string>()
  const entities: string[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const values = row as Record<string, unknown>
    const name = ['displayName', 'cn', 'name', 'ou'].map(key => values[key]).find(value => typeof value === 'string')
    if (typeof name !== 'string') continue
    const clean = name.trim().replace(/\s+/g, ' ').slice(0, 120)
    const key = clean.toLocaleLowerCase('fr')
    if (clean && !seen.has(key)) { seen.add(key); entities.push(clean) }
  }
  return entities
}

/** Interroge une API REST générique pour un aperçu d'entités. Cette primitive
 * doit être appelée uniquement après validation d'URL et contrôle RBAC. */
type EntitySyncFetcher = (input: string, init?: RequestInit) => Promise<Response>

export async function fetchRestEntities(endpoint: string, token: string | null, fetcher: EntitySyncFetcher = fetch): Promise<string[]> {
  const safeEndpoint = validateSyncEndpoint(endpoint)
  if (!safeEndpoint) throw new Error('endpoint_invalide')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5_000)
  try {
    const response = await fetcher(safeEndpoint, {
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      redirect: 'manual', signal: controller.signal,
    })
    if (!response.ok) throw new Error(`http_${response.status}`)
    const contentLength = Number(response.headers.get('content-length') ?? '0')
    if (Number.isFinite(contentLength) && contentLength > MAX_REST_RESPONSE_BYTES) throw new Error('response_too_large')
    const payload = await readLimitedJson(response)
    const rows = Array.isArray(payload) ? payload : payload && typeof payload === 'object'
      ? (['items', 'data', 'results'] as const).map(key => (payload as Record<string, unknown>)[key]).find(Array.isArray)
      : []
    return normalizeExternalEntities(rows)
  } finally { clearTimeout(timer) }
}

/** Lecture LDAP bornée. Seul LDAPS est accepté : les identifiants ne transitent
 * jamais en clair. Le filtre est une configuration d'admin, pas une saisie libre. */
export async function fetchLdapEntities(opts: { url: string; bindDN: string; password: string; baseDN: string; filter?: string; resolveHost?: (hostname: string) => Promise<string> }): Promise<string[]> {
  const safeUrl = validateLdapEndpoint(opts.url)
  if (!safeUrl || !opts.bindDN || !opts.password || !opts.baseDN) throw new Error('ldap_config_invalide')
  const { Client } = await import('ldapts')
  // Anti-SSRF (N02) : l'hôte est résolu puis validé (IP publique) par l'appelant ; on se
  // connecte à CETTE IP (pas de second DNS) en gardant le nom d'hôte pour le SNI et la
  // vérification du certificat.
  let url = safeUrl
  let servername: string | undefined
  if (opts.resolveHost) {
    const parsed = new URL(safeUrl)
    const ip = await opts.resolveHost(parsed.hostname)
    servername = parsed.hostname.replace(/^\[|\]$/g, '')
    parsed.hostname = ip.includes(':') ? `[${ip}]` : ip
    url = parsed.toString()
  }
  const client = new Client({ url, timeout: 5_000, connectTimeout: 5_000, tlsOptions: { rejectUnauthorized: true, ...(servername ? { servername } : {}) } })
  try {
    await client.bind(opts.bindDN, opts.password)
    const result = await client.search(opts.baseDN, { scope: 'sub', filter: opts.filter || '(objectClass=organizationalUnit)', attributes: ['displayName', 'cn', 'ou'], sizeLimit: 500 })
    return normalizeExternalEntities(result.searchEntries)
  } finally { await client.unbind().catch(() => {}) }
}
