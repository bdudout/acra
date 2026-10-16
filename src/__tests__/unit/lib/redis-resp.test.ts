// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import net from 'node:net'
import {
  encodeCommand, parseReply, parseRedisUrl, parseSentinelList, createRespClient, RedisUnavailableError, type RespClient,
} from '@/lib/redis-resp'

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

interface Fake {
  port: number; commands: string[][]; connections: number
  /** État mutable : simule une bascule (ancien primaire rétrogradé en réplique). */
  state: { role: 'master' | 'slave'; readonly: boolean }
  close(): Promise<void>; dropConnections(): void
}

async function fakeServer(opts: { password?: string; role?: 'master' | 'slave' } = {}): Promise<Fake> {
  const state: Fake['state'] = { role: opts.role ?? 'master', readonly: opts.role === 'slave' }
  let connections = 0
  const data = new Map<string, { v: string; exp: number | null }>()
  const commands: string[][] = []
  const sockets = new Set<net.Socket>()
  const reply = (cmd: string[], authed: { ok: boolean }): string => {
    const [name, ...a] = cmd
    const up = name.toUpperCase()
    if (up === 'AUTH') { const pw = a[a.length - 1]; authed.ok = pw === opts.password; return authed.ok ? '+OK\r\n' : '-WRONGPASS invalid\r\n' }
    if (opts.password && !authed.ok) return '-NOAUTH Authentication required.\r\n'
    const live = (k: string) => { const e = data.get(k); if (e && e.exp != null && e.exp <= Date.now()) { data.delete(k); return undefined } return e }
    if (state.readonly && ['INCR', 'PEXPIRE', 'DEL'].includes(up)) return "-READONLY You can't write against a read only replica.\r\n"
    switch (up) {
      case 'PING': return '+PONG\r\n'
      case 'ROLE': return state.role === 'master' ? '*3\r\n$6\r\nmaster\r\n:0\r\n*0\r\n' : '*5\r\n$5\r\nslave\r\n$9\r\n127.0.0.1\r\n:6379\r\n$9\r\nconnected\r\n:0\r\n'
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
    connections++
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
    port, commands, state,
    get connections() { return connections },
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

  it('mauvais mot de passe : erreur stable « redis_indisponible », code WRONGPASS, sans le message du serveur', async () => {
    srv = await fakeServer({ password: 'bon' })
    client = createRespClient(`redis://:mauvais@127.0.0.1:${srv.port}`)
    const err = await client.ping().catch(e => e)
    expect(err).toBeInstanceOf(RedisUnavailableError)
    expect(err.message).toBe('redis_indisponible')
    expect(err.code).toBe('WRONGPASS')
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
    await expect(client.ping()).rejects.toMatchObject({ message: 'redis_indisponible', code: 'ECONNREFUSED' })
  })

  it('délai de réponse dépassé : rejet', async () => {
    const conns: net.Socket[] = []
    const s = net.createServer(c => { conns.push(c) /* ne répond jamais */ })
    await new Promise<void>(r => s.listen(0, '127.0.0.1', r))
    const port = (s.address() as net.AddressInfo).port
    client = createRespClient(`redis://127.0.0.1:${port}`, { commandTimeoutMs: 100 })
    const err = await client.ping().catch(e => e)
    expect(err).toBeInstanceOf(RedisUnavailableError)
    expect(err).toMatchObject({ message: 'redis_indisponible', code: 'redis_timeout' })
    await client.quit().catch(() => undefined); client = null
    for (const c of conns) c.destroy()
    await new Promise<void>(r => s.close(() => r()))
  })
})

// ── Bascule (Redis managé) ────────────────────────────────────────────────────

describe('redis-resp — reconnexion après bascule', () => {
  let srv: Fake | null = null
  let client: RespClient | null = null
  afterEach(async () => { await client?.quit().catch(() => undefined); client = null; await srv?.close(); srv = null })

  it('réponse -READONLY (ancien primaire rétrogradé) : rejet stable, connexion fermée, nouvelle connexion ensuite', async () => {
    srv = await fakeServer()
    client = createRespClient(`redis://127.0.0.1:${srv.port}`)
    expect(await client.incr('k')).toBe(1)
    expect(srv.connections).toBe(1)
    srv.state.readonly = true
    await expect(client.incr('k')).rejects.toMatchObject({ message: 'redis_indisponible', code: 'redis_lecture_seule' })
    // Le point d'entrée pointe à nouveau sur un primaire : la commande suivante ouvre une NOUVELLE connexion.
    srv.state.readonly = false
    expect(await client.incr('k')).toBe(2)
    expect(srv.connections).toBe(2)
  })

  it('les commandes en vol sur une connexion coupée sont rejetées (jamais rejouées) puis la suivante se reconnecte', async () => {
    const conns: net.Socket[] = []
    const s = net.createServer(c => { conns.push(c) })
    await new Promise<void>(r => s.listen(0, '127.0.0.1', r))
    const port = (s.address() as net.AddressInfo).port
    client = createRespClient(`redis://127.0.0.1:${port}`, { commandTimeoutMs: 2_000 })
    const p = client.incr('x')
    await new Promise(r => setTimeout(r, 30))
    for (const c of conns) c.destroy()
    await expect(p).rejects.toMatchObject({ message: 'redis_indisponible', code: 'redis_connexion_fermee' })
    await new Promise<void>(r => s.close(() => r()))
  })

  it('serveur tombé puis relancé sur le même point d’entrée : reprise sans redémarrer le client', async () => {
    srv = await fakeServer()
    const port = srv.port
    client = createRespClient(`redis://127.0.0.1:${port}`, { connectTimeoutMs: 300 })
    expect(await client.ping()).toBe('PONG')
    await srv.close(); srv = null
    await expect(client.ping()).rejects.toBeInstanceOf(RedisUnavailableError)
    // Nouveau serveur sur le même port (DNS/IP flottante qui pointe sur le nouveau primaire).
    const s2 = net.createServer(c => c.on('data', () => c.write('+PONG\r\n')))
    await new Promise<void>(r => s2.listen(port, '127.0.0.1', r))
    expect(await client.ping()).toBe('PONG')
    await client.quit(); client = null
    await new Promise<void>(r => s2.close(() => r()))
  })
})

// ── Redis Sentinel (auto-hébergé) ─────────────────────────────────────────────

interface FakeSentinel { port: number; commands: string[][]; master: { host: string; port: number } | null; close(): Promise<void> }

async function fakeSentinel(master: { host: string; port: number } | null, opts: { password?: string } = {}): Promise<FakeSentinel> {
  const commands: string[][] = []
  const sockets = new Set<net.Socket>()
  const self: FakeSentinel = { port: 0, commands, master, close: async () => undefined }
  const server = net.createServer(sock => {
    sockets.add(sock)
    sock.on('close', () => sockets.delete(sock))
    let buf = Buffer.alloc(0)
    let authed = !opts.password
    sock.on('data', chunk => {
      buf = Buffer.concat([buf, chunk as Buffer])
      for (;;) {
        const r = parseReply(buf, 0)
        if (!r) break
        buf = buf.subarray(r.next)
        const cmd = (r.value as unknown[]).map(String)
        commands.push(cmd)
        const up = cmd[0].toUpperCase()
        if (up === 'AUTH') { authed = cmd[cmd.length - 1] === opts.password; sock.write(authed ? '+OK\r\n' : '-WRONGPASS invalid\r\n'); continue }
        if (!authed) { sock.write('-NOAUTH Authentication required.\r\n'); continue }
        if (up === 'SENTINEL' && cmd[1]?.toLowerCase() === 'get-master-addr-by-name' && cmd[2] === 'acra' && self.master) {
          const h = self.master.host, p = String(self.master.port)
          sock.write(`*2\r\n$${h.length}\r\n${h}\r\n$${p.length}\r\n${p}\r\n`)
        } else if (up === 'SENTINEL') sock.write('*-1\r\n')
        else sock.write(`-ERR unknown command '${cmd[0]}'\r\n`)
      }
    })
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  self.port = (server.address() as net.AddressInfo).port
  self.close = () => new Promise<void>(r => { for (const s of sockets) s.destroy(); server.close(() => r()) })
  return self
}

async function closedPort(): Promise<number> {
  const s = net.createServer(); await new Promise<void>(r => s.listen(0, '127.0.0.1', r))
  const port = (s.address() as net.AddressInfo).port
  await new Promise<void>(r => s.close(() => r()))
  return port
}

describe('redis-resp — Redis Sentinel', () => {
  const cleanups: (() => Promise<unknown>)[] = []
  let client: RespClient | null = null
  afterEach(async () => {
    await client?.quit().catch(() => undefined); client = null
    for (const c of cleanups.splice(0)) await c()
  })
  const track = <T extends { close(): Promise<unknown> }>(x: T): T => { cleanups.push(() => x.close()); return x }
  const ep = (port: number) => ({ host: '127.0.0.1', port })

  it('liste des sentinelles : hôte[:port] séparés par des virgules (port 26379 par défaut, IPv6 entre crochets)', () => {
    expect(parseSentinelList('s1:26379, s2 ,[::1]:26380')).toEqual([
      { host: 's1', port: 26379 }, { host: 's2', port: 26379 }, { host: '::1', port: 26380 },
    ])
    expect(() => parseSentinelList('')).toThrow(/redis_sentinelles_invalides/)
    expect(() => parseSentinelList('s1:abc')).toThrow(/redis_sentinelles_invalides/)
    expect(() => parseSentinelList('s1:70000')).toThrow(/redis_sentinelles_invalides/)
  })

  it('découvre le primaire, s’y authentifie, vérifie ROLE = master, puis exécute les commandes', async () => {
    const master = track(await fakeServer({ password: 'pw' }))
    const s1 = track(await fakeSentinel(ep(master.port), { password: 'spw' }))
    client = createRespClient({ sentinel: { sentinels: [ep(s1.port)], masterName: 'acra', password: 'spw' }, tls: false, password: 'pw' })
    expect(await client.incr('k')).toBe(1)
    expect(s1.commands).toEqual([['AUTH', 'spw'], ['SENTINEL', 'get-master-addr-by-name', 'acra']])
    expect(master.commands.slice(0, 3)).toEqual([['AUTH', 'pw'], ['ROLE'], ['INCR', 'k']])
  })

  it('essaie les sentinelles dans l’ordre : la première injoignable est ignorée', async () => {
    const master = track(await fakeServer())
    const s2 = track(await fakeSentinel(ep(master.port)))
    client = createRespClient(
      { sentinel: { sentinels: [ep(await closedPort()), ep(s2.port)], masterName: 'acra' }, tls: false },
      { connectTimeoutMs: 500 },
    )
    expect(await client.ping()).toBe('PONG')
  })

  it('sentinelle obsolète désignant une réplique : refus (ROLE ≠ master) et essai de la sentinelle suivante', async () => {
    const replica = track(await fakeServer({ role: 'slave' }))
    const master = track(await fakeServer())
    const stale = track(await fakeSentinel(ep(replica.port)))
    const fresh = track(await fakeSentinel(ep(master.port)))
    client = createRespClient({ sentinel: { sentinels: [ep(stale.port), ep(fresh.port)], masterName: 'acra' }, tls: false })
    expect(await client.incr('k')).toBe(1)
    expect(replica.commands.some(c => c[0] === 'INCR')).toBe(false)
    expect(master.commands.some(c => c[0] === 'INCR')).toBe(true)
  })

  it('réplique seule connue : rejet stable « redis_pas_primaire »', async () => {
    const replica = track(await fakeServer({ role: 'slave' }))
    const s1 = track(await fakeSentinel(ep(replica.port)))
    client = createRespClient({ sentinel: { sentinels: [ep(s1.port)], masterName: 'acra' }, tls: false })
    await expect(client.incr('k')).rejects.toMatchObject({ message: 'redis_indisponible', code: 'redis_pas_primaire' })
  })

  it('nom de primaire inconnu des sentinelles : rejet stable « redis_primaire_inconnu »', async () => {
    const s1 = track(await fakeSentinel(null))
    client = createRespClient({ sentinel: { sentinels: [ep(s1.port)], masterName: 'acra' }, tls: false })
    await expect(client.ping()).rejects.toMatchObject({ message: 'redis_indisponible', code: 'redis_primaire_inconnu' })
  })

  it('toutes les sentinelles injoignables : rejet borné (pas d’attente infinie)', async () => {
    client = createRespClient(
      { sentinel: { sentinels: [ep(await closedPort()), ep(await closedPort())], masterName: 'acra' }, tls: false },
      { connectTimeoutMs: 300 },
    )
    const t0 = Date.now()
    await expect(client.ping()).rejects.toBeInstanceOf(RedisUnavailableError)
    expect(Date.now() - t0).toBeLessThan(2_000)
  })

  it('bascule : connexion au primaire coupée → la reconnexion redécouvre le NOUVEAU primaire', async () => {
    const a = track(await fakeServer())
    const b = track(await fakeServer())
    const s1 = track(await fakeSentinel(ep(a.port)))
    client = createRespClient({ sentinel: { sentinels: [ep(s1.port)], masterName: 'acra' }, tls: false })
    expect(await client.incr('k')).toBe(1)
    // Sentinel promeut B ; A est rétrogradé (répond READONLY) puis coupe les connexions.
    s1.master = ep(b.port)
    a.state.readonly = true
    await expect(client.incr('k')).rejects.toMatchObject({ code: 'redis_lecture_seule' })
    expect(await client.incr('k')).toBe(1) // compteur de B (données non répliquées par le faux serveur)
    expect(b.commands.some(c => c[0] === 'INCR')).toBe(true)
    a.dropConnections()
    expect(await client.incr('k')).toBe(2)
  })

  it('la sentinelle qui a répondu passe en tête (les suivantes reconnexions ne retentent pas la morte d’abord)', async () => {
    const master = track(await fakeServer())
    const good = track(await fakeSentinel(ep(master.port)))
    const dead = await closedPort()
    client = createRespClient({ sentinel: { sentinels: [ep(dead), ep(good.port)], masterName: 'acra' }, tls: false }, { connectTimeoutMs: 300 })
    expect(await client.ping()).toBe('PONG')
    master.dropConnections()
    await new Promise(r => setTimeout(r, 20))
    expect(await client.ping()).toBe('PONG')
    expect(good.commands.filter(c => c[0] === 'SENTINEL')).toHaveLength(2)
  })
})
