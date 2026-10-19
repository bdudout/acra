// ─── Stockage des documents — adaptateur S3 compatible (sans dépendance) ──────
// Chargé dynamiquement par lib/document-storage.ts quand DOCUMENT_STORAGE=s3 (multi-instance :
// toutes les instances lisent et écrivent les mêmes objets). Cible : stockage objet S3 compatible
// souverain (OVH Object Storage, Scaleway, Outscale, MinIO, Garage…), bucket VERSIONNÉ et chiffré
// (voir docs/deploiement-haute-disponibilite.md).
//
// Signature AWS Signature Version 4 implémentée avec node:crypto (aucun SDK) ; transport : fetch.
// Les clés de stockage sont déjà préfixées par organisation (lib/document.ts, storageKeyFor :
// `<organizationId>/<documentId>/<fichier>`) ; S3_PREFIX ajoute un préfixe global facultatif
// (bucket mutualisé). Intégrité : chaque PUT porte Content-MD5 (le serveur refuse un corps altéré)
// et l'empreinte SHA-256 signée du corps.
//
// Variables : S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
// S3_FORCE_PATH_STYLE (défaut true), S3_SSE (AES256|1 → x-amz-server-side-encryption: AES256),
// S3_PREFIX, S3_SESSION_TOKEN (identifiants temporaires), S3_TIMEOUT_MS (défaut 30 000).

import { createHash, createHmac } from 'node:crypto'
import type { DocumentStorage } from '@/lib/document-storage'

export const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

const sha256Hex = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')
const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data, 'utf8').digest()

/** Encodage RFC 3986 d'un segment (A-Z a-z 0-9 - . _ ~ conservés), comme l'exige SigV4. */
function encodeRfc3986(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

/** Encode un chemin d'objet segment par segment (les « / » restent des séparateurs). */
export function encodeS3Path(path: string): string {
  return path.split('/').map(encodeRfc3986).join('/')
}

/** Clé de signature : HMAC(HMAC(HMAC(HMAC("AWS4"+secret, date), région), service), "aws4_request"). */
export function deriveSigningKey(secretAccessKey: string, date: string, region: string, service: string): Buffer {
  return hmac(hmac(hmac(hmac('AWS4' + secretAccessKey, date), region), service), 'aws4_request')
}

export interface SignV4Input {
  method: string
  url: URL
  /** En-têtes à signer en plus de host / x-amz-date / x-amz-content-sha256. */
  headers: Record<string, string>
  payloadHash: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  region: string
  service?: string
  /** Horodatage ISO 8601 de base (AAAAMMJJTHHMMSSZ). */
  amzDate: string
}

/**
 * Signe une requête (AWS SigV4, en-tête Authorization, corps en un seul bloc). Rend les en-têtes à
 * envoyer (Host exclu : posé par fetch, mais signé) et les étapes intermédiaires (tests).
 */
export function signV4(input: SignV4Input): { headers: Record<string, string>; canonicalRequest: string; stringToSign: string; signature: string } {
  const service = input.service ?? 's3'
  const date = input.amzDate.slice(0, 8)
  const all: Record<string, string> = {}
  for (const [k, v] of Object.entries(input.headers)) all[k.toLowerCase()] = String(v).trim().replace(/\s+/g, ' ')
  all.host = input.url.host
  all['x-amz-date'] = input.amzDate
  all['x-amz-content-sha256'] = input.payloadHash
  if (input.sessionToken) all['x-amz-security-token'] = input.sessionToken

  const names = Object.keys(all).sort()
  const signedHeaders = names.join(';')
  const canonicalHeaders = names.map(n => `${n}:${all[n]}\n`).join('')
  const query = [...input.url.searchParams.entries()]
    .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(v)] as const)
    .sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`).join('&')
  // Le chemin de l'URL est déjà encodé (encodeS3Path) : S3 ne le ré-encode pas.
  const canonicalUri = input.url.pathname || '/'
  const canonicalRequest = [input.method, canonicalUri, query, canonicalHeaders, signedHeaders, input.payloadHash].join('\n')
  const scope = `${date}/${input.region}/${service}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', input.amzDate, scope, sha256Hex(canonicalRequest)].join('\n')
  const signature = createHmac('sha256', deriveSigningKey(input.secretAccessKey, date, input.region, service)).update(stringToSign, 'utf8').digest('hex')

  const headers: Record<string, string> = { ...all }
  delete headers.host
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope},SignedHeaders=${signedHeaders},Signature=${signature}`
  return { headers, canonicalRequest, stringToSign, signature }
}

// ── Configuration ────────────────────────────────────────────────────────────

export interface S3Config {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  forcePathStyle: boolean
  sse: 'AES256' | null
  prefix: string
  timeoutMs: number
}

const truthy = (v: string | undefined, dflt: boolean) => v == null || v.trim() === '' ? dflt : /^(1|true|yes|oui)$/i.test(v.trim())

/** Lit et valide la configuration S3. Erreur claire nommant la variable manquante (jamais sa valeur). */
export function s3ConfigFromEnv(env: Record<string, string | undefined> = process.env): S3Config {
  const req = (name: string) => {
    const v = env[name]?.trim()
    if (!v) throw new Error(`DOCUMENT_STORAGE=s3 : variable ${name} manquante.`)
    return v
  }
  const endpoint = req('S3_ENDPOINT').replace(/\/+$/, '')
  if (!/^https?:\/\/[^/]+$/i.test(endpoint)) throw new Error('DOCUMENT_STORAGE=s3 : S3_ENDPOINT doit être une URL http(s)://hôte[:port] sans chemin.')
  const sseRaw = env.S3_SSE?.trim() ?? ''
  let sse: S3Config['sse'] = null
  if (/^(1|true|AES256)$/i.test(sseRaw)) sse = 'AES256'
  else if (sseRaw && !/^(0|false|non|no)$/i.test(sseRaw)) throw new Error('DOCUMENT_STORAGE=s3 : S3_SSE accepte AES256 (ou 1) ; le chiffrement par clé KMS n\'est pas pris en charge.')
  const prefixRaw = (env.S3_PREFIX ?? '').trim().replace(/^\/+|\/+$/g, '')
  const timeout = Number(env.S3_TIMEOUT_MS)
  return {
    endpoint,
    region: req('S3_REGION'),
    bucket: req('S3_BUCKET'),
    accessKeyId: req('S3_ACCESS_KEY_ID'),
    secretAccessKey: req('S3_SECRET_ACCESS_KEY'),
    sessionToken: env.S3_SESSION_TOKEN?.trim() || undefined,
    forcePathStyle: truthy(env.S3_FORCE_PATH_STYLE, true),
    sse,
    prefix: prefixRaw ? prefixRaw + '/' : '',
    timeoutMs: Number.isInteger(timeout) && timeout > 0 ? timeout : 30_000,
  }
}

/** URL de l'objet pour une clé de stockage (préfixe appliqué ; clé vide, absolue ou avec « .. » refusée). */
export function s3ObjectUrl(cfg: S3Config, key: string): URL {
  if (!key || key.startsWith('/') || key.split('/').some(seg => seg === '..' || seg === '.' || seg === '')) throw new Error('cle_invalide')
  const objectPath = encodeS3Path(cfg.prefix + key)
  const ep = new URL(cfg.endpoint)
  return cfg.forcePathStyle
    ? new URL(`${ep.protocol}//${ep.host}/${encodeRfc3986(cfg.bucket)}/${objectPath}`)
    : new URL(`${ep.protocol}//${cfg.bucket}.${ep.host}/${objectPath}`)
}

const amzNow = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

export interface S3DocumentStorage extends DocumentStorage {
  /** Métadonnées d'un objet (taille) ou null s'il est absent. */
  head(key: string): Promise<{ size: number } | null>
}

/** Adaptateur S3 compatible. Point d'entrée attendu par lib/document-storage.ts (`s3Storage()`). */
export function s3Storage(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): S3DocumentStorage {
  const cfg = s3ConfigFromEnv(env)

  const request = async (method: string, key: string, body?: Buffer, extra: Record<string, string> = {}) => {
    const url = s3ObjectUrl(cfg, key)
    const payloadHash = body ? sha256Hex(body) : EMPTY_SHA256
    const { headers } = signV4({
      method, url, headers: extra, payloadHash,
      accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, sessionToken: cfg.sessionToken,
      region: cfg.region, amzDate: amzNow(),
    })
    return fetchImpl(url.toString(), {
      method, headers,
      body: body ? new Uint8Array(body) : undefined,
      signal: AbortSignal.timeout(cfg.timeoutMs),
      redirect: 'error',
    })
  }

  // Erreurs : uniquement des codes stables (le corps XML d'erreur S3 n'est jamais relayé).
  const fail = (op: string, status: number, code?: string) => Object.assign(new Error(`s3_${op}_echec:${status}`), code ? { code } : {})

  return {
    async put(key, bytes, mime) {
      const extra: Record<string, string> = {
        'content-md5': createHash('md5').update(bytes).digest('base64'),
        'content-type': mime || 'application/octet-stream',
      }
      if (cfg.sse) extra['x-amz-server-side-encryption'] = cfg.sse
      const res = await request('PUT', key, bytes, extra)
      await res.body?.cancel().catch(() => undefined)
      if (!res.ok) throw fail('put', res.status)
    },
    async get(key) {
      const res = await request('GET', key)
      if (!res.ok) {
        await res.body?.cancel().catch(() => undefined)
        throw fail('get', res.status, res.status === 404 ? 'ENOENT' : undefined)
      }
      return Buffer.from(await res.arrayBuffer())
    },
    async delete(key) {
      const res = await request('DELETE', key)
      await res.body?.cancel().catch(() => undefined)
      if (!res.ok && res.status !== 404) throw fail('delete', res.status)
    },
    async head(key) {
      const res = await request('HEAD', key)
      if (res.status === 404) return null
      if (!res.ok) throw fail('head', res.status)
      return { size: Number(res.headers.get('content-length') ?? 0) }
    },
  }
}
