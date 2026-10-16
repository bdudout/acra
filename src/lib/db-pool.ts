// ─── Réglage du pool de connexions PostgreSQL (T22) ───────────────────────────
// Prisma 7 passe par l'adaptateur `pg` : les paramètres `connection_limit` / `pool_timeout` de
// l'URL ne sont PAS lus (pg.Pool lit `max`, `connectionTimeoutMillis`…). Sans réglage, le pool
// compte 10 connexions et l'attente d'une connexion libre était INFINIE (requêtes figées sous charge).
import type { PoolConfig } from 'pg'

const entier = (v: string | undefined, min: number): number | undefined => {
  const n = Number(v)
  return Number.isInteger(n) && n >= min ? n : undefined
}

/**
 * DB_POOL_MAX (défaut 10), DB_POOL_TIMEOUT_MS (attente d'une connexion libre, défaut 15 000),
 * DB_POOL_IDLE_MS (défaut 30 000), DB_STATEMENT_TIMEOUT_MS (durée maximale d'une requête, non bornée par défaut).
 */
export function poolConfigFromEnv(env: Record<string, string | undefined> = process.env): PoolConfig {
  const statement = entier(env.DB_STATEMENT_TIMEOUT_MS, 1)
  return {
    connectionString: env.DATABASE_URL,
    max: entier(env.DB_POOL_MAX, 1) ?? 10,
    connectionTimeoutMillis: entier(env.DB_POOL_TIMEOUT_MS, 1) ?? 15_000,
    idleTimeoutMillis: entier(env.DB_POOL_IDLE_MS, 1) ?? 30_000,
    ...(statement ? { statement_timeout: statement } : {}),
  }
}
