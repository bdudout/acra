// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest'
import { configureSharedStores, sharedStoreStartupMessage } from '@/lib/shared-store.server'
import { configureRateLimitStore, getRateLimitStore, InMemoryRateLimitStore, rateLimit } from '@/lib/rate-limit'
import { RedisRateLimitStore } from '@/lib/rate-limit-redis'
import { configureLockoutStore, getLockoutStore, MemoryLockoutStore, RedisLockoutStore } from '@/lib/login-lockout'
import type { RespClient } from '@/lib/redis-resp'

function fakeClient(opts: { pingFails?: boolean } = {}) {
  const counts = new Map<string, number>()
  const client: RespClient = {
    command: async () => 'OK',
    ping: async () => { if (opts.pingFails) throw new Error('ECONNREFUSED'); return 'PONG' },
    incr: async k => { const v = (counts.get(k) ?? 0) + 1; counts.set(k, v); return v },
    pexpire: async () => 1,
    pttl: async () => 60_000,
    del: async k => (counts.delete(k) ? 1 : 0),
    get: async k => (counts.has(k) ? String(counts.get(k)) : null),
    quit: vi.fn(async () => undefined),
  }
  return { client, counts }
}
const silent = { info: () => undefined, warn: () => undefined }

afterEach(() => {
  configureRateLimitStore(null)
  configureLockoutStore(null)
  vi.unstubAllEnvs()
})

describe('configureSharedStores', () => {
  it('sans REDIS_URL : stores mémoire (installation mono-instance par défaut)', async () => {
    const create = vi.fn()
    expect(await configureSharedStores({}, { createClient: create, log: silent })).toBe('memoire')
    expect(create).not.toHaveBeenCalled()
    expect(getRateLimitStore()).toBeInstanceOf(InMemoryRateLimitStore)
    expect(getLockoutStore()).toBeInstanceOf(MemoryLockoutStore)
  })

  it('REDIS_URL joignable : limites de débit ET verrouillage de compte passent par Redis', async () => {
    const { client, counts } = fakeClient()
    const create = vi.fn(() => client)
    expect(await configureSharedStores({ REDIS_URL: 'redis://cache:6379' }, { createClient: create, log: silent })).toBe('redis')
    expect(create).toHaveBeenCalledWith('redis://cache:6379')
    expect(getRateLimitStore()).toBeInstanceOf(RedisRateLimitStore)
    expect(getLockoutStore()).toBeInstanceOf(RedisLockoutStore)
    await rateLimit('login:ip:1.2.3.4', 5, 60_000)
    expect(counts.get('rl:login:ip:1.2.3.4')).toBe(1)
  })

  it('REDIS_URL injoignable : refus de démarrer (pas de repli silencieux sur un store non partagé)', async () => {
    const { client } = fakeClient({ pingFails: true })
    await expect(configureSharedStores({ REDIS_URL: 'redis://cache:6379' }, { createClient: () => client, log: silent }))
      .rejects.toThrow(/REDIS_URL[\s\S]*injoignable[\s\S]*REDIS_OPTIONNEL/)
    expect(getRateLimitStore()).toBeInstanceOf(InMemoryRateLimitStore)
    expect(client.quit).toHaveBeenCalled()
  })

  it('REDIS_URL invalide : refus de démarrer, sans divulguer le mot de passe', async () => {
    await expect(configureSharedStores({ REDIS_URL: 'http://user:topsecret@x' }, { log: silent }))
      .rejects.toThrow(/REDIS_URL/)
    await expect(configureSharedStores({ REDIS_URL: 'http://user:topsecret@x' }, { log: silent }))
      .rejects.not.toThrow(/topsecret/)
  })

  it('REDIS_OPTIONNEL=1 : repli explicite sur la mémoire avec avertissement', async () => {
    const { client } = fakeClient({ pingFails: true })
    const warn = vi.fn()
    const mode = await configureSharedStores(
      { REDIS_URL: 'redis://cache:6379', REDIS_OPTIONNEL: '1' },
      { createClient: () => client, log: { info: () => undefined, warn } },
    )
    expect(mode).toBe('memoire_secours')
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/NON partagés/))
    expect(getRateLimitStore()).toBeInstanceOf(InMemoryRateLimitStore)
  })

  it('le store mémoire par défaut est stable d’un appel à l’autre, y compris en production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(getRateLimitStore()).toBe(getRateLimitStore())
    expect(getLockoutStore()).toBe(getLockoutStore())
  })

  it('message de démarrage lisible, sans secret', () => {
    expect(sharedStoreStartupMessage('redis', 'redis://u:pw@cache:6379/1')).toMatch(/cache:6379/)
    expect(sharedStoreStartupMessage('redis', 'redis://u:pw@cache:6379/1')).not.toMatch(/pw/)
    expect(sharedStoreStartupMessage('memoire')).toMatch(/mono-instance/)
  })
})
