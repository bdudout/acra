/**
 * rate-limit-redis.ts — Store de rate limiting PARTAGÉ (multi-instance).
 *
 * Implémente `RateLimitStore` avec le primitif distribué standard : compteur
 * atomique `INCR` + expiration `PEXPIRE` posée au premier hit (fenêtre fixe).
 * Toutes les instances de l'application partagent alors le même compteur.
 *
 * Aucune dépendance ajoutée : le client Redis est passé par l'appelant via
 * l'interface minimale `RedisLike` (compatible `redis` / `ioredis`). Câblage au
 * démarrage :
 *   import { createClient } from 'redis'
 *   const client = createClient({ url: process.env.REDIS_URL }); await client.connect()
 *   configureRateLimitStore(new RedisRateLimitStore(client))
 */
import type { RateLimitStore, RateLimitResult } from '@/lib/rate-limit'

/** Sous-ensemble d'un client Redis nécessaire au rate limiting (compatible node-redis / ioredis). */
export interface RedisLike {
  incr(key: string): Promise<number>
  /** Pose une expiration en millisecondes sur la clé. */
  pexpire(key: string, ms: number): Promise<unknown>
  /** TTL restant en ms ; < 0 si la clé n'a pas d'expiration (ou n'existe pas). */
  pttl(key: string): Promise<number>
  del(key: string): Promise<unknown>
}

export class RedisRateLimitStore implements RateLimitStore {
  constructor(
    private readonly redis: RedisLike,
    /** Préfixe des clés pour cloisonner de l'app dans un Redis mutualisé. */
    private readonly prefix = 'rl:',
  ) {}

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const k = this.prefix + key
    const count = await this.redis.incr(k)
    // Fenêtre fixe : l'expiration n'est posée qu'au tout premier hit de la fenêtre.
    if (count === 1) {
      await this.redis.pexpire(k, windowMs)
    }
    let ttl = await this.redis.pttl(k)
    // Garde-fou : si la clé a perdu son TTL (ex. écriture concurrente), on le rétablit
    // pour éviter un compteur qui ne se réinitialise jamais.
    if (ttl < 0) {
      await this.redis.pexpire(k, windowMs)
      ttl = windowMs
    }
    const remaining = Number.isFinite(limit) ? Math.max(0, limit - count) : Infinity
    return { allowed: count <= limit, remaining, resetAt: Date.now() + ttl }
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(this.prefix + key)
  }
}
