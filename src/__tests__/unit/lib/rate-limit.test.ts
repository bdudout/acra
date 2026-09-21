import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import {
  rateLimit, rateLimitHeaders, configureRateLimitStore, getRateLimitStore,
  InMemoryRateLimitStore, type RateLimitStore, type RateLimitResult,
} from '@/lib/rate-limit'
import { RedisRateLimitStore, type RedisLike } from '@/lib/rate-limit-redis'

afterEach(() => {
  configureRateLimitStore(null) // rétablit le store mémoire par défaut
  vi.restoreAllMocks()
})

describe('rateLimit — store en mémoire (défaut)', () => {
  it('autorise jusqu\'à la limite puis bloque, avec un « remaining » décroissant', async () => {
    const key = `test:${Math.random()}`
    const r1 = await rateLimit(key, 2, 60_000)
    const r2 = await rateLimit(key, 2, 60_000)
    const r3 = await rateLimit(key, 2, 60_000)
    expect(r1).toMatchObject({ allowed: true, remaining: 1 })
    expect(r2).toMatchObject({ allowed: true, remaining: 0 })
    expect(r3.allowed).toBe(false)
  })

  it('repart à zéro quand la fenêtre est expirée', async () => {
    vi.useFakeTimers()
    try {
      const key = `win:${Math.random()}`
      expect((await rateLimit(key, 1, 1_000)).allowed).toBe(true)
      expect((await rateLimit(key, 1, 1_000)).allowed).toBe(false)
      vi.advanceTimersByTime(1_001)
      expect((await rateLimit(key, 1, 1_000)).allowed).toBe(true) // fenêtre réinitialisée
    } finally {
      vi.useRealTimers()
    }
  })

  it('isole les compteurs par clé', async () => {
    const a = `a:${Math.random()}`, b = `b:${Math.random()}`
    await rateLimit(a, 1, 60_000)
    expect((await rateLimit(a, 1, 60_000)).allowed).toBe(false)
    expect((await rateLimit(b, 1, 60_000)).allowed).toBe(true) // clé indépendante
  })
})

describe('configureRateLimitStore — point d\'injection unique', () => {
  it('route les appels vers le store injecté (ex. store partagé multi-instance)', async () => {
    const calls: Array<[string, number, number]> = []
    const fake: RateLimitStore = {
      hit: async (key, limit, windowMs): Promise<RateLimitResult> => {
        calls.push([key, limit, windowMs])
        return { allowed: false, remaining: 0, resetAt: 42 }
      },
      reset: async () => {},
    }
    configureRateLimitStore(fake)
    expect(getRateLimitStore()).toBe(fake)
    const res = await rateLimit('k', 5, 1_000)
    expect(res).toEqual({ allowed: false, remaining: 0, resetAt: 42 })
    expect(calls).toEqual([['k', 5, 1_000]]) // la limite EST transmise au store (corrige l'ancien cast)
  })

  it('null rétablit le store mémoire par défaut', () => {
    const fake = { hit: async () => ({ allowed: true, remaining: 0, resetAt: 0 }), reset: async () => {} }
    configureRateLimitStore(fake)
    configureRateLimitStore(null)
    expect(getRateLimitStore()).toBeInstanceOf(InMemoryRateLimitStore)
  })
})

describe('RedisRateLimitStore — store distribué (adaptateur)', () => {
  function fakeRedis() {
    const counters = new Map<string, number>()
    const ttls = new Map<string, number>()
    const client: RedisLike = {
      incr: vi.fn(async (k: string) => { const n = (counters.get(k) ?? 0) + 1; counters.set(k, n); return n }),
      pexpire: vi.fn(async (k: string, ms: number) => { ttls.set(k, ms); return 1 }),
      pttl: vi.fn(async (k: string) => ttls.get(k) ?? -1),
      del: vi.fn(async (k: string) => { counters.delete(k); ttls.delete(k); return 1 }),
    }
    return { client, counters, ttls }
  }

  it('pose l\'expiration au premier hit et décide selon le compteur partagé', async () => {
    const { client } = fakeRedis()
    const store = new RedisRateLimitStore(client)
    const r1 = await store.hit('login:ip', 2, 5_000)
    expect(r1.allowed).toBe(true)
    expect(client.incr).toHaveBeenCalledWith('rl:login:ip')
    expect(client.pexpire).toHaveBeenCalledWith('rl:login:ip', 5_000) // TTL posé au 1er hit
    const r2 = await store.hit('login:ip', 2, 5_000)
    const r3 = await store.hit('login:ip', 2, 5_000)
    expect(r2.allowed).toBe(true)
    expect(r3.allowed).toBe(false) // 3e > limite 2
    expect(client.pexpire).toHaveBeenCalledTimes(1) // TTL non ré-armé aux hits suivants
  })

  it('ré-arme le TTL si la clé n\'en a pas (garde-fou)', async () => {
    const { client, ttls } = fakeRedis()
    const store = new RedisRateLimitStore(client)
    await client.incr('rl:x') // clé pré-existante SANS ttl (pttl = -1)
    const r = await store.hit('x', 5, 3_000)
    expect(r.allowed).toBe(true)
    expect(ttls.get('rl:x')).toBe(3_000) // TTL rétabli
  })

  it('reset supprime la clé partagée', async () => {
    const { client } = fakeRedis()
    const store = new RedisRateLimitStore(client)
    await store.hit('y', 1, 1_000)
    await store.reset('y')
    expect(client.del).toHaveBeenCalledWith('rl:y')
    expect((await store.hit('y', 1, 1_000)).allowed).toBe(true) // repart à zéro après reset
  })
})

describe('rateLimitHeaders', () => {
  it('expose Retry-After / X-RateLimit-* cohérents', () => {
    const resetAt = Date.now() + 30_000
    const h = rateLimitHeaders(3, resetAt)
    expect(h['X-RateLimit-Remaining']).toBe('3')
    expect(Number(h['Retry-After'])).toBeGreaterThan(0)
    expect(Number(h['Retry-After'])).toBeLessThanOrEqual(30)
  })
})
