// ─── Client Redis minimal (protocole RESP2) — sans dépendance ──────────────────
// Sert uniquement le store partagé des limites de débit et du verrouillage de compte
// (lib/rate-limit-redis.ts, lib/login-lockout.ts) en multi-instance (REDIS_URL ou REDIS_SENTINELS).
// Pourquoi pas le paquet `redis` / `ioredis` : l'image Docker est construite en sortie
// « standalone » (seules les dépendances déclarées y sont tracées) et aucune dépendance
// n'est ajoutée pour une fonction optionnelle. Le besoin se limite à cinq commandes
// atomiques (INCR, PEXPIRE, PTTL, GET, DEL) + AUTH/SELECT/PING (+ ROLE et SENTINEL en mode Sentinel).
//
// Fonctionnement : une connexion TCP (ou TLS) établie à la première commande — poignée de main
// (AUTH, SELECT, et en mode Sentinel : découverte du primaire + vérification ROLE = master)
// terminée AVANT toute commande utilisateur —, commandes en pipeline (réponses dans l'ordre
// d'envoi : file FIFO), délai de connexion et délai par commande. Toute panne de transport
// (connexion refusée/coupée, délai dépassé, réponse -READONLY d'un ancien primaire rétrogradé)
// détruit la connexion et rejette les commandes en vol avec une erreur STABLE
// `RedisUnavailableError` (message « redis_indisponible », détail dans `code`). La commande
// suivante rouvre une connexion : nouvelle résolution DNS (Redis managé) ou nouvelle découverte
// par les sentinelles (auto-hébergé). Aucune commande n'est rejouée automatiquement : l'erreur
// remonte à l'appelant (intégrité avant disponibilité, comportement « fermé » borné dans le temps).

import net from 'node:net'
import tls from 'node:tls'
import type { RedisLike } from '@/lib/rate-limit-redis'

export type RespValue = string | number | null | Error | RespValue[]

/** Encode une commande Redis (tableau de chaînes « bulk »), longueurs en octets. */
export function encodeCommand(args: string[]): Buffer {
  const parts: Buffer[] = [Buffer.from(`*${args.length}\r\n`)]
  for (const a of args) {
    const b = Buffer.from(a, 'utf8')
    parts.push(Buffer.from(`$${b.length}\r\n`), b, Buffer.from('\r\n'))
  }
  return Buffer.concat(parts)
}

/** Analyse UNE réponse à partir de `start`. `null` si le tampon est incomplet. */
export function parseReply(buf: Buffer, start: number): { value: RespValue; next: number } | null {
  if (start >= buf.length) return null
  const eol = buf.indexOf('\r\n', start)
  if (eol < 0) return null
  const type = String.fromCharCode(buf[start])
  const line = buf.toString('utf8', start + 1, eol)
  const after = eol + 2
  switch (type) {
    case '+': return { value: line, next: after }
    case '-': return { value: new Error(line), next: after }
    case ':': return { value: Number(line), next: after }
    case '$': {
      const len = Number(line)
      if (len < 0) return { value: null, next: after }
      if (buf.length < after + len + 2) return null
      return { value: buf.toString('utf8', after, after + len), next: after + len + 2 }
    }
    case '*': {
      const n = Number(line)
      if (n < 0) return { value: null, next: after }
      const items: RespValue[] = []
      let pos = after
      for (let i = 0; i < n; i++) {
        const r = parseReply(buf, pos)
        if (!r) return null
        items.push(r.value)
        pos = r.next
      }
      return { value: items, next: pos }
    }
    default:
      throw new Error(`redis_reponse_invalide:${type}`)
  }
}

export interface RedisUrl { host: string; port: number; tls: boolean; username?: string; password?: string; db?: number }

/** Lit `redis://[user:pass@]hote[:port][/base]` ou `rediss://…` (TLS). */
export function parseRedisUrl(raw: string): RedisUrl {
  let u: URL
  try { u = new URL(raw) } catch { throw new Error('redis_url_invalide') }
  if (u.protocol !== 'redis:' && u.protocol !== 'rediss:') throw new Error('redis_url_invalide')
  const dbPath = u.pathname.replace(/^\//, '')
  const db = dbPath ? Number(dbPath) : undefined
  if (db !== undefined && (!Number.isInteger(db) || db < 0)) throw new Error('redis_url_invalide')
  return {
    host: u.hostname.replace(/^\[|\]$/g, ''),
    port: u.port ? Number(u.port) : 6379,
    tls: u.protocol === 'rediss:',
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db,
  }
}

/** Panne de transport Redis. Message stable « redis_indisponible » ; détail (sans secret) dans `code`. */
export class RedisUnavailableError extends Error {
  readonly code: string
  constructor(code: string) {
    super('redis_indisponible')
    this.name = 'RedisUnavailableError'
    this.code = code
  }
}

const unavailable = (e: unknown, fallback = 'redis_erreur'): RedisUnavailableError => {
  if (e instanceof RedisUnavailableError) return e
  const code = (e as NodeJS.ErrnoException | undefined)?.code
  return new RedisUnavailableError(typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) ? code : fallback)
}

/** Premier mot d'une réponse d'erreur Redis (WRONGPASS, NOAUTH, READONLY…), jamais le texte complet. */
const errorWord = (e: Error) => (/^[A-Z][A-Z_]*/.exec(e.message)?.[0] ?? 'ERR')

export interface RedisEndpoint { host: string; port: number }

/** Configuration complète : point d'entrée fixe (REDIS_URL) OU sentinelles (REDIS_SENTINELS). */
export interface RedisClientConfig {
  endpoint?: RedisEndpoint
  sentinel?: { sentinels: RedisEndpoint[]; masterName: string; password?: string }
  tls: boolean
  username?: string
  password?: string
  db?: number
}

/** `hote1:26379,hote2,[::1]:26380` → points d'entrée (port 26379 par défaut). */
export function parseSentinelList(raw: string): RedisEndpoint[] {
  const items = raw.split(',').map(x => x.trim()).filter(Boolean)
  if (!items.length) throw new Error('redis_sentinelles_invalides')
  return items.map(item => {
    const m = /^(?:\[([^\]]+)\]|([^:[\]\s]+))(?::(\d+))?$/.exec(item)
    if (!m) throw new Error('redis_sentinelles_invalides')
    const port = m[3] ? Number(m[3]) : 26379
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('redis_sentinelles_invalides')
    return { host: m[1] ?? m[2], port }
  })
}

export function configFromUrl(raw: string): RedisClientConfig {
  const u = parseRedisUrl(raw)
  return { endpoint: { host: u.host, port: u.port }, tls: u.tls, username: u.username, password: u.password, db: u.db }
}

export interface RespClientOptions {
  /** Délai d'établissement de chaque connexion TCP/TLS (ms). Défaut 2 000. */
  connectTimeoutMs?: number
  /** Délai de réponse par commande, poignée de main comprise (ms). Défaut 2 000. */
  commandTimeoutMs?: number
}

export interface RespClient extends RedisLike {
  command(args: string[]): Promise<RespValue>
  ping(): Promise<string>
  quit(): Promise<void>
}

interface Pending { resolve: (v: RespValue) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }

/** Une connexion : socket + file FIFO des réponses attendues. */
interface Conn {
  send(args: string[]): Promise<RespValue>
  destroy(err: Error): void
  readonly dead: boolean
}

function openConn(ep: RedisEndpoint, useTls: boolean, connectTimeoutMs: number, commandTimeoutMs: number): Promise<Conn> {
  return new Promise<Conn>((resolveOpen, rejectOpen) => {
    let buffer: Buffer = Buffer.alloc(0)
    let queue: Pending[] = []
    let dead = false
    let opened = false

    const s = useTls
      ? tls.connect({ host: ep.host, port: ep.port, servername: net.isIP(ep.host) ? undefined : ep.host })
      : net.connect({ host: ep.host, port: ep.port })

    const destroy = (err: Error) => {
      if (dead) return
      dead = true
      clearTimeout(connectTimer)
      s.removeAllListeners('data')
      s.destroy()
      const e = unavailable(err)
      const q = queue
      queue = []
      for (const p of q) { clearTimeout(p.timer); p.reject(e) }
      if (!opened) rejectOpen(e)
    }

    const connectTimer = setTimeout(() => destroy(new RedisUnavailableError('redis_connexion_delai')), connectTimeoutMs)

    s.setNoDelay(true)
    s.on('error', err => destroy(err))
    s.on('close', () => destroy(new RedisUnavailableError('redis_connexion_fermee')))
    s.on('data', (chunk: Buffer) => {
      buffer = buffer.length ? Buffer.concat([buffer, chunk]) : chunk
      let pos = 0
      for (;;) {
        let r: ReturnType<typeof parseReply>
        try { r = parseReply(buffer, pos) } catch { destroy(new RedisUnavailableError('redis_reponse_invalide')); return }
        if (!r) break
        pos = r.next
        const p = queue.shift()
        if (!p) { destroy(new RedisUnavailableError('redis_reponse_inattendue')); return }
        clearTimeout(p.timer)
        if (r.value instanceof Error) {
          // Ancien primaire rétrogradé (bascule) : connexion inutilisable → la fermer pour que la
          // commande suivante rejoigne le nouveau primaire.
          if (/^READONLY\b/.test(r.value.message)) {
            p.reject(new RedisUnavailableError('redis_lecture_seule'))
            destroy(new RedisUnavailableError('redis_lecture_seule'))
            return
          }
          p.reject(r.value)
        } else p.resolve(r.value)
      }
      buffer = pos ? buffer.subarray(pos) : buffer
    })
    s.once(useTls ? 'secureConnect' : 'connect', () => {
      if (dead) return
      clearTimeout(connectTimer)
      // Détecte un pair disparu sans fermeture (hôte du primaire perdu) entre deux commandes.
      s.setKeepAlive(true, 10_000)
      opened = true
      resolveOpen(conn)
    })

    const conn: Conn = {
      get dead() { return dead },
      destroy,
      send: args => new Promise<RespValue>((resolve, reject) => {
        if (dead) { reject(new RedisUnavailableError('redis_connexion_fermee')); return }
        const timer = setTimeout(() => destroy(new RedisUnavailableError('redis_timeout')), commandTimeoutMs)
        queue.push({ resolve, reject, timer })
        s.write(encodeCommand(args))
      }),
    }
  })
}

/**
 * Client Redis minimal. La connexion s'ouvre à la première commande et se rouvre après une panne.
 * `target` : URL redis:// / rediss:// ou configuration complète (mode Sentinel).
 */
export function createRespClient(target: string | RedisClientConfig, opts: RespClientOptions = {}): RespClient {
  const cfg = typeof target === 'string' ? configFromUrl(target) : target
  if (!cfg.endpoint === !cfg.sentinel) throw new Error('redis_config_invalide')
  const connectTimeoutMs = opts.connectTimeoutMs ?? 2_000
  const commandTimeoutMs = opts.commandTimeoutMs ?? 2_000
  // Copie locale : la sentinelle qui répond passe en tête pour les reconnexions suivantes.
  const sentinels = cfg.sentinel ? [...cfg.sentinel.sentinels] : []

  let conn: Conn | null = null
  let connecting: Promise<Conn> | null = null
  let closed = false

  const open = (ep: RedisEndpoint) => openConn(ep, cfg.tls, connectTimeoutMs, commandTimeoutMs)

  /** Exécute une commande de poignée de main ; toute réponse d'erreur rend la connexion inutilisable. */
  const handshakeCmd = async (c: Conn, args: string[]): Promise<RespValue> => {
    try { return await c.send(args) } catch (e) {
      const err = e instanceof RedisUnavailableError ? e : new RedisUnavailableError(errorWord(e as Error))
      c.destroy(err)
      throw err
    }
  }

  const connectData = async (ep: RedisEndpoint, checkRole: boolean): Promise<Conn> => {
    const c = await open(ep)
    if (cfg.password) await handshakeCmd(c, cfg.username ? ['AUTH', cfg.username, cfg.password] : ['AUTH', cfg.password])
    if (cfg.db) await handshakeCmd(c, ['SELECT', String(cfg.db)])
    if (checkRole) {
      const role = await handshakeCmd(c, ['ROLE'])
      if (!Array.isArray(role) || role[0] !== 'master') {
        const err = new RedisUnavailableError('redis_pas_primaire')
        c.destroy(err)
        throw err
      }
    }
    return c
  }

  /** Demande l'adresse du primaire à une sentinelle (connexion courte). `null` : nom inconnu. */
  const askSentinel = async (ep: RedisEndpoint): Promise<RedisEndpoint | null> => {
    const c = await open(ep)
    try {
      if (cfg.sentinel?.password) await handshakeCmd(c, ['AUTH', cfg.sentinel.password])
      const r = await handshakeCmd(c, ['SENTINEL', 'get-master-addr-by-name', cfg.sentinel!.masterName])
      if (!Array.isArray(r) || r.length < 2) return null
      const port = Number(r[1])
      if (typeof r[0] !== 'string' || !Number.isInteger(port)) return null
      return { host: r[0], port }
    } finally {
      c.destroy(new RedisUnavailableError('redis_connexion_fermee'))
    }
  }

  const establish = async (): Promise<Conn> => {
    if (cfg.endpoint) return connectData(cfg.endpoint, false)
    // Sentinelles essayées dans l'ordre ; redécouverte à CHAQUE (re)connexion.
    let lastErr: RedisUnavailableError = new RedisUnavailableError('redis_sentinelles_injoignables')
    for (let i = 0; i < sentinels.length; i++) {
      const s = sentinels[i]
      let master: RedisEndpoint | null
      try { master = await askSentinel(s) } catch (e) { lastErr = unavailable(e, 'redis_sentinelle_erreur'); continue }
      if (!master) { lastErr = new RedisUnavailableError('redis_primaire_inconnu'); continue }
      try {
        const c = await connectData(master, true)
        if (i > 0) { sentinels.splice(i, 1); sentinels.unshift(s) }
        return c
      } catch (e) { lastErr = unavailable(e) }
    }
    throw lastErr
  }

  const getConn = (): Promise<Conn> => {
    if (closed) return Promise.reject(new Error('redis_client_ferme'))
    if (conn && !conn.dead) return Promise.resolve(conn)
    conn = null
    connecting ??= establish().then(
      c => {
        connecting = null
        if (closed) { c.destroy(new Error('redis_client_ferme')); throw new Error('redis_client_ferme') }
        conn = c
        return c
      },
      e => { connecting = null; throw unavailable(e) },
    )
    return connecting
  }

  const command = async (args: string[]): Promise<RespValue> => (await getConn()).send(args)

  const num = async (args: string[]) => {
    const v = await command(args)
    if (typeof v !== 'number') throw new Error('redis_reponse_inattendue')
    return v
  }

  return {
    command,
    async ping() { return String(await command(['PING'])) },
    incr: key => num(['INCR', key]),
    pexpire: (key, ms) => num(['PEXPIRE', key, String(Math.max(1, Math.ceil(ms)))]),
    pttl: key => num(['PTTL', key]),
    del: key => num(['DEL', key]),
    async get(key) {
      const v = await command(['GET', key])
      return v == null ? null : String(v)
    },
    async quit() {
      closed = true
      const c = conn
      conn = null
      if (!c || c.dead) return
      try { await c.send(['QUIT']) } catch { /* déjà fermé */ }
      c.destroy(new Error('redis_client_ferme'))
    },
  }
}
