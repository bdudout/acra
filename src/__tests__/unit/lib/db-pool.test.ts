import { describe, it, expect } from 'vitest'
import { poolConfigFromEnv } from '@/lib/db-pool'

describe('poolConfigFromEnv', () => {
  it('défauts : 10 connexions, attente d\'une connexion bornée à 15 s, pas de statement_timeout', () => {
    expect(poolConfigFromEnv({ DATABASE_URL: 'postgresql://x' })).toEqual({
      connectionString: 'postgresql://x', max: 10, connectionTimeoutMillis: 15_000, idleTimeoutMillis: 30_000,
    })
  })
  it('réglages par variables d\'environnement', () => {
    expect(poolConfigFromEnv({ DATABASE_URL: 'u', DB_POOL_MAX: '40', DB_POOL_TIMEOUT_MS: '5000', DB_POOL_IDLE_MS: '60000', DB_STATEMENT_TIMEOUT_MS: '30000' }))
      .toEqual({ connectionString: 'u', max: 40, connectionTimeoutMillis: 5000, idleTimeoutMillis: 60_000, statement_timeout: 30_000 })
  })
  it('valeurs invalides ignorées (défaut conservé)', () => {
    const c = poolConfigFromEnv({ DATABASE_URL: 'u', DB_POOL_MAX: '0', DB_POOL_TIMEOUT_MS: '-1', DB_STATEMENT_TIMEOUT_MS: 'abc' })
    expect(c.max).toBe(10)
    expect(c.connectionTimeoutMillis).toBe(15_000)
    expect(c).not.toHaveProperty('statement_timeout')
  })
})
