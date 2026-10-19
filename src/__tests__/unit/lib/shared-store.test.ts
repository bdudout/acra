// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest'
import { configureSharedStores, sharedStoreStartupMessage, redisConfigFromEnv } from '@/lib/shared-store.server'
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
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: { host: 'cache', port: 6379 }, tls: false }),
      { connectTimeoutMs: 2_000, commandTimeoutMs: 2_000 },
    )
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

  it('message de démarrage en mode Sentinel : sentinelles et nom du primaire, sans secret', () => {
    const cfg = redisConfigFromEnv({ REDIS_SENTINELS: 's1:26379,s2:26379', REDIS_SENTINEL_MASTER: 'acra', REDIS_PASSWORD: 'pw', REDIS_SENTINEL_PASSWORD: 'spw' })!
    const msg = sharedStoreStartupMessage('redis', cfg.config)
    expect(msg).toMatch(/Sentinel/)
    expect(msg).toMatch(/s1:26379,s2:26379/)
    expect(msg).toMatch(/acra/)
    expect(msg).not.toMatch(/pw/)
  })
})

describe('redisConfigFromEnv', () => {
  it('rien de défini : null (mémoire)', () => {
    expect(redisConfigFromEnv({})).toBeNull()
  })

  it('REDIS_SENTINELS : sentinelles, nom du primaire, mots de passe, TLS facultatif', () => {
    expect(redisConfigFromEnv({
      REDIS_SENTINELS: 'h1:26379, h2:26379,h3', REDIS_SENTINEL_MASTER: 'acra',
      REDIS_SENTINEL_PASSWORD: 'spw', REDIS_PASSWORD: 'pw', REDIS_USERNAME: 'acra-app', REDIS_TLS: '1',
    })).toEqual({
      config: {
        sentinel: { sentinels: [{ host: 'h1', port: 26379 }, { host: 'h2', port: 26379 }, { host: 'h3', port: 26379 }], masterName: 'acra', password: 'spw' },
        tls: true, username: 'acra-app', password: 'pw', db: undefined,
      },
      options: { connectTimeoutMs: 2_000, commandTimeoutMs: 2_000 },
    })
  })

  it('REDIS_URL et REDIS_SENTINELS sont exclusifs : erreur claire', () => {
    expect(() => redisConfigFromEnv({ REDIS_URL: 'redis://c:6379', REDIS_SENTINELS: 'h1', REDIS_SENTINEL_MASTER: 'acra' }))
      .toThrow(/REDIS_URL et REDIS_SENTINELS sont exclusifs/)
  })

  it('REDIS_SENTINELS sans REDIS_SENTINEL_MASTER, ou liste invalide : erreur claire', () => {
    expect(() => redisConfigFromEnv({ REDIS_SENTINELS: 'h1' })).toThrow(/REDIS_SENTINEL_MASTER/)
    expect(() => redisConfigFromEnv({ REDIS_SENTINELS: 'h1:abc', REDIS_SENTINEL_MASTER: 'acra' })).toThrow(/REDIS_SENTINELS invalide/)
  })

  it('mot de passe via REDIS_PASSWORD (URL sans mot de passe) ; les deux, différents : erreur', () => {
    expect(redisConfigFromEnv({ REDIS_URL: 'redis://cache:6379', REDIS_PASSWORD: 'pw' })!.config.password).toBe('pw')
    expect(redisConfigFromEnv({ REDIS_URL: 'redis://:url@cache:6379' })!.config.password).toBe('url')
    // Identiques (URL construite à partir de REDIS_PASSWORD) : accepté.
    expect(redisConfigFromEnv({ REDIS_URL: 'redis://:pw@cache:6379', REDIS_PASSWORD: 'pw' })!.config.password).toBe('pw')
    expect(() => redisConfigFromEnv({ REDIS_URL: 'redis://:url@cache:6379', REDIS_PASSWORD: 'pw' })).toThrow(/REDIS_PASSWORD/)
    expect(() => redisConfigFromEnv({ REDIS_URL: 'redis://:url@cache:6379', REDIS_PASSWORD: 'pw' })).not.toThrow(/url@|pw\b/)
  })

  it('REDIS_TIMEOUT_MS : délai de connexion et de commande ; valeur invalide → erreur', () => {
    expect(redisConfigFromEnv({ REDIS_URL: 'redis://c', REDIS_TIMEOUT_MS: '750' })!.options).toEqual({ connectTimeoutMs: 750, commandTimeoutMs: 750 })
    expect(() => redisConfigFromEnv({ REDIS_URL: 'redis://c', REDIS_TIMEOUT_MS: 'abc' })).toThrow(/REDIS_TIMEOUT_MS/)
    expect(() => redisConfigFromEnv({ REDIS_URL: 'redis://c', REDIS_TIMEOUT_MS: '10' })).toThrow(/REDIS_TIMEOUT_MS/)
  })
})

describe('configureSharedStores — mode Sentinel et erreurs de configuration', () => {
  it('REDIS_SENTINELS joignable : stores Redis, client créé avec la configuration Sentinel', async () => {
    const { client } = fakeClient()
    const create = vi.fn(() => client)
    const mode = await configureSharedStores(
      { REDIS_SENTINELS: 'h1:26379,h2:26379,h3:26379', REDIS_SENTINEL_MASTER: 'acra' },
      { createClient: create, log: silent },
    )
    expect(mode).toBe('redis')
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ sentinel: expect.objectContaining({ masterName: 'acra' }) }), expect.anything())
    expect(getLockoutStore()).toBeInstanceOf(RedisLockoutStore)
  })

  it('configuration incohérente : refus de démarrer MÊME avec REDIS_OPTIONNEL=1 (le repli ne couvre que l’indisponibilité)', async () => {
    await expect(configureSharedStores(
      { REDIS_URL: 'redis://c:6379', REDIS_SENTINELS: 'h1', REDIS_SENTINEL_MASTER: 'acra', REDIS_OPTIONNEL: '1' },
      { createClient: vi.fn(), log: silent },
    )).rejects.toThrow(/exclusifs/)
  })

  it('sentinelles injoignables : refus de démarrer, message sans mot de passe', async () => {
    const { client } = fakeClient({ pingFails: true })
    const err = await configureSharedStores(
      { REDIS_SENTINELS: 'h1:26379', REDIS_SENTINEL_MASTER: 'acra', REDIS_PASSWORD: 'topsecret' },
      { createClient: () => client, log: silent },
    ).then(() => new Error('inattendu'), (e: Error) => e)
    expect(err.message).toMatch(/injoignable/)
    expect(err.message).not.toMatch(/topsecret/)
  })
})

