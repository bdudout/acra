// ─── Client Redis minimal (protocole RESP2) — sans dépendance ──────────────────
// Sert uniquement le store partagé des limites de débit et du verrouillage de compte
// (lib/rate-limit-redis.ts, lib/login-lockout.ts) en multi-instance (REDIS_URL).
// Pourquoi pas le paquet `redis` / `ioredis` : l'image Docker est construite en sortie
// « standalone » (seules les dépendances déclarées y sont tracées) et aucune dépendance
// n'est ajoutée pour une fonction optionnelle. Le besoin se limite à cinq commandes
// atomiques (INCR, PEXPIRE, PTTL, GET, DEL) + AUTH/SELECT/PING.
//
// Fonctionnement : une connexion TCP (ou TLS pour rediss://) ouverte à la première commande,
// commandes en pipeline (les réponses Redis arrivent dans l'ordre d'envoi : file FIFO),
// délai par commande (au-delà, la connexion est détruite et toutes les commandes en vol
// sont rejetées), reconnexion paresseuse à la commande suivante. Aucune commande n'est
// rejouée automatiquement : une erreur remonte à l'appelant (intégrité avant disponibilité).

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

export interface RespClientOptions {
  /** Délai d'établissement de la connexion (ms). Défaut 5 000. */
  connectTimeoutMs?: number
  /** Délai de réponse par commande (ms). Défaut 5 000. */
  commandTimeoutMs?: number
}

export interface RespClient extends RedisLike {
  command(args: string[]): Promise<RespValue>
  ping(): Promise<string>
  quit(): Promise<void>
}

interface Pending { resolve: (v: RespValue) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }

/** Client Redis minimal. La connexion s'ouvre à la première commande. */
export function createRespClient(url: string, opts: RespClientOptions = {}): RespClient {
  const cfg = parseRedisUrl(url)
  const connectTimeoutMs = opts.connectTimeoutMs ?? 5_000
  const commandTimeoutMs = opts.commandTimeoutMs ?? 5_000

  let socket: net.Socket | null = null
  let buffer: Buffer = Buffer.alloc(0)
  let queue: Pending[] = []
  let closed = false

  const failAll = (err: Error) => {
    const q = queue
    queue = []
    for (const p of q) { clearTimeout(p.timer); p.reject(err) }
  }

  const teardown = (err: Error) => {
    const s = socket
    socket = null
    buffer = Buffer.alloc(0)
    if (s) { s.removeAllListeners('data'); s.destroy() }
    failAll(err)
  }

  const onData = (chunk: Buffer) => {
    buffer = buffer.length ? Buffer.concat([buffer, chunk]) : chunk
    let pos = 0
    for (;;) {
      let r: ReturnType<typeof parseReply>
      try { r = parseReply(buffer, pos) } catch (e) { teardown(e as Error); return }
      if (!r) break
      pos = r.next
      const p = queue.shift()
      if (!p) { teardown(new Error('redis_reponse_inattendue')); return }
      clearTimeout(p.timer)
      if (r.value instanceof Error) p.reject(r.value)
      else p.resolve(r.value)
    }
    buffer = pos ? buffer.subarray(pos) : buffer
  }

  const open = (): net.Socket => {
    const s = cfg.tls
      ? tls.connect({ host: cfg.host, port: cfg.port, servername: net.isIP(cfg.host) ? undefined : cfg.host })
      : net.connect({ host: cfg.host, port: cfg.port })
    s.setNoDelay(true)
    s.setTimeout(connectTimeoutMs, () => { if (s.connecting) teardown(new Error('redis_connexion_delai')) })
    s.once(cfg.tls ? 'secureConnect' : 'connect', () => s.setTimeout(0))
    s.on('data', onData)
    s.on('error', err => { if (socket === s) teardown(err) })
    s.on('close', () => { if (socket === s) teardown(new Error('redis_connexion_fermee')) })
    socket = s
    // Commandes d'initialisation mises en file AVANT toute commande utilisateur
    // (écrites dans le tampon du socket, envoyées à la connexion).
    const init: string[][] = []
    if (cfg.password) init.push(cfg.username ? ['AUTH', cfg.username, cfg.password] : ['AUTH', cfg.password])
    if (cfg.db) init.push(['SELECT', String(cfg.db)])
    for (const c of init) {
      send(s, c).catch(() => undefined) // l'échec rejette aussi la commande suivante (connexion détruite)
    }
    return s
  }

  const send = (s: net.Socket, args: string[]): Promise<RespValue> =>
    new Promise<RespValue>((resolve, reject) => {
      const timer = setTimeout(() => { if (socket === s) teardown(new Error('redis_timeout')) }, commandTimeoutMs)
      const isAuth = args[0] === 'AUTH' || args[0] === 'SELECT'
      queue.push({
        resolve,
        reject: isAuth
          ? (e: Error) => { reject(e); if (socket === s) teardown(e) } // échec d'authentification : connexion inutilisable
          : reject,
        timer,
      })
      s.write(encodeCommand(args))
    })

  const command = (args: string[]): Promise<RespValue> => {
    if (closed) return Promise.reject(new Error('redis_client_ferme'))
    return send(socket ?? open(), args)
  }

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
      const s = socket
      if (!s) return
      try { await send(s, ['QUIT']) } catch { /* déjà fermé */ }
      teardown(new Error('redis_client_ferme'))
    },
  }
}
