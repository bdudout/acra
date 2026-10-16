// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import net from 'node:net'
import { encodeCommand, parseReply, parseRedisUrl, createRespClient, type RespClient } from '@/lib/redis-resp'

describe('redis-resp — protocole RESP2', () => {
  it('encode une commande en tableau de chaînes binaires (longueur en octets)', () => {
    expect(encodeCommand(['SET', 'clé', 'v']).toString()).toBe('*3\r\n$3\r\nSET\r\n$4\r\nclé\r\n$1\r\nv\r\n')
  })

  it('analyse les types de réponse et signale une réponse incomplète', () => {
    expect(parseReply(Buffer.from('+OK\r\n'), 0)).toEqual({ value: 'OK', next: 5 })
    expect(parseReply(Buffer.from(':42\r\n'), 0)).toEqual({ value: 42, next: 5 })
    expect(parseReply(Buffer.from('$-1\r\n'), 0)).toEqual({ value: null, next: 5 })
    expect(parseReply(Buffer.from('$5\r\nhé\r\n\r\n'), 0)?.value).toBe('hé\r\n')
    expect(parseReply(Buffer.from('*2\r\n:1\r\n$1\r\na\r\n'), 0)?.value).toEqual([1, 'a'])
    const err = parseReply(Buffer.from('-ERR boom\r\n'), 0)?.value
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe('ERR boom')
    // Incomplet : attendre la suite
    expect(parseReply(Buffer.from('$5\r\nab'), 0)).toBeNull()
    expect(parseReply(Buffer.from('*2\r\n:1\r\n'), 0)).toBeNull()
    expect(parseReply(Buffer.from(':4'), 0)).toBeNull()
  })

  it('lit l’URL redis:// / rediss:// (identifiants encodés, base)', () => {
    expect(parseRedisUrl('redis://localhost')).toEqual({ host: 'localhost', port: 6379, tls: false, username: undefined, password: undefined, db: undefined })
    expect(parseRedisUrl('rediss://user:p%40ss@cache.example:6380/2')).toEqual({ host: 'cache.example', port: 6380, tls: true, username: 'user', password: 'p@ss', db: 2 })
    expect(parseRedisUrl('redis://:secret@r:6379')).toMatchObject({ username: undefined, password: 'secret' })
    expect(() => parseRedisUrl('http://x')).toThrow(/redis_url_invalide/)
  })
})

// ── Faux serveur Redis (TCP réel) ─────────────────────────────────────────────

interface Fake { port: number; commands: string[][]; close(): Promise<void>; dropConnections(): void }

async function fakeServer(opts: { password?: string } = {}): Promise<Fake> {
  const data = new Map<string, { v: string; exp: number | null }>()
  const commands: string[][] = []
  const sockets = new Set<net.Socket>()
  const reply = (cmd: string[], authed: { ok: boolean }): string => {
    const [name, ...a] = cmd
    const up = name.toUpperCase()
    if (up === 'AUTH') { const pw = a[a.length - 1]; authed.ok = pw === opts.password; return authed.ok ? '+OK\r\n' : '-WRONGPASS invalid\r\n' }
    if (opts.password && !authed.ok) return '-NOAUTH Authentication required.\r\n'
    const live = (k: string) => { const e = data.get(k); if (e && e.exp != null && e.exp <= Date.now()) { data.delete(k); return undefined } return e }
    switch (up) {
      case 'PING': return '+PONG\r\n'
      case 'SELECT': return '+OK\r\n'
      case 'INCR': { const e = live(a[0]); const v = Number(e?.v ?? 0) + 1; data.set(a[0], { v: String(v), exp: e?.exp ?? null }); return `:${v}\r\n` }
      case 'PEXPIRE': { const e = live(a[0]); if (e) e.exp = Date.now() + Number(a[1]); return `:${e ? 1 : 0}\r\n` }
      case 'PTTL': { const e = live(a[0]); return `:${!e ? -2 : e.exp == null ? -1 : e.exp - Date.now()}\r\n` }
      case 'GET': { const e = live(a[0]); return e ? `$${Buffer.byteLength(e.v)}\r\n${e.v}\r\n` : '$-1\r\n' }
      case 'DEL': return `:${data.delete(a[0]) ? 1 : 0}\r\n`
      case 'QUIT': return '+OK\r\n'
      default: return `-ERR unknown command '${name}'\r\n`
    }
  }
  const server = net.createServer(sock => {
    sockets.add(sock)
    sock.on('close', () => sockets.delete(sock))
    let buf = Buffer.alloc(0)
    const authed = { ok: false }
    sock.on('data', chunk => {
      buf = Buffer.concat([buf, chunk as Buffer])
      let out = ''
      for (;;) {
        const r = parseReply(buf, 0)
        if (!r) break
        buf = buf.subarray(r.next)
        const cmd = (r.value as unknown[]).map(String)
        commands.push(cmd)
        out += reply(cmd, authed)
      }
      // Réponse découpée en deux paquets : le client doit réassembler.
      if (out) { const half = Math.ceil(out.length / 2); sock.write(out.slice(0, half)); setTimeout(() => sock.write(out.slice(half)), 2) }
    })
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  const port = (server.address() as net.AddressInfo).port
  return {
    port, commands,
    dropConnections: () => { for (const s of sockets) s.destroy() },
    close: () => new Promise<void>(r => { for (const s of sockets) s.destroy(); server.close(() => r()) }),
  }
}

describe('redis-resp — client TCP', () => {
  let srv: Fake | null = null
  let client: RespClient | null = null
  afterEach(async () => { await client?.quit().catch(() => undefined); client = null; await srv?.close(); srv = null })

  it('s’authentifie, sélectionne la base puis exécute INCR/PEXPIRE/PTTL/GET/DEL', async () => {
    srv = await fakeServer({ password: 's3cret' })
    client = createRespClient(`redis://acra:s3cret@127.0.0.1:${srv.port}/3`)
    expect(await client.ping()).toBe('PONG')
    expect(await client.incr('k')).toBe(1)
    expect(await client.incr('k')).toBe(2)
    expect(await client.pexpire('k', 60_000)).toBe(1)
    const ttl = await client.pttl('k')
    expect(ttl).toBeGreaterThan(59_000)
    expect(await client.get('k')).toBe('2')
    expect(await client.del('k')).toBe(1)
    expect(await client.get('k')).toBeNull()
    expect(await client.pttl('k')).toBe(-2)
    expect(srv.commands[0]).toEqual(['AUTH', 'acra', 's3cret'])
    expect(srv.commands[1]).toEqual(['SELECT', '3'])
  })

  it('conserve l’ordre des réponses pour des commandes concurrentes (pipeline)', async () => {
    srv = await fakeServer()
    client = createRespClient(`redis://127.0.0.1:${srv.port}`)
    const r = await Promise.all(Array.from({ length: 20 }, () => client!.incr('c')))
    expect(r).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('rejette une réponse d’erreur sans casser la connexion', async () => {
    srv = await fakeServer()
    client = createRespClient(`redis://127.0.0.1:${srv.port}`)
    await expect(client.command(['NOPE'])).rejects.toThrow(/unknown command/)
    expect(await client.ping()).toBe('PONG')
  })

  it('mauvais mot de passe : erreur explicite', async () => {
    srv = await fakeServer({ password: 'bon' })
    client = createRespClient(`redis://:mauvais@127.0.0.1:${srv.port}`)
    await expect(client.ping()).rejects.toThrow(/WRONGPASS/)
  })

  it('se reconnecte à la commande suivante après une coupure', async () => {
    srv = await fakeServer()
    client = createRespClient(`redis://127.0.0.1:${srv.port}`)
    expect(await client.incr('r')).toBe(1)
    srv.dropConnections()
    await new Promise(r => setTimeout(r, 20))
    expect(await client.incr('r')).toBe(2)
  })

  it('serveur injoignable : rejet (pas d’attente infinie)', async () => {
    const s = net.createServer(); await new Promise<void>(r => s.listen(0, '127.0.0.1', r))
    const port = (s.address() as net.AddressInfo).port
    await new Promise<void>(r => s.close(() => r()))
    client = createRespClient(`redis://127.0.0.1:${port}`, { connectTimeoutMs: 500 })
    await expect(client.ping()).rejects.toThrow()
  })

  it('délai de réponse dépassé : rejet', async () => {
    const conns: net.Socket[] = []
    const s = net.createServer(c => { conns.push(c) /* ne répond jamais */ })
    await new Promise<void>(r => s.listen(0, '127.0.0.1', r))
    const port = (s.address() as net.AddressInfo).port
    client = createRespClient(`redis://127.0.0.1:${port}`, { commandTimeoutMs: 100 })
    await expect(client.ping()).rejects.toThrow(/redis_timeout/)
    await client.quit().catch(() => undefined); client = null
    for (const c of conns) c.destroy()
    await new Promise<void>(r => s.close(() => r()))
  })
})
