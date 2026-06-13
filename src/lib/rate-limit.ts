/**
 * rate-limit.ts — Limiteur de débit avec abstraction de store
 *
 * Architecture Redis-ready :
 *  - En développement ou single-instance : store in-memory (Map)
 *  - En production multi-instance        : implémenter RedisRateLimitStore
 *    et le passer à createRateLimiter()
 *
 * Usage :
 *   import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
 *   const rl = rateLimit('login:ip:1.2.3.4', 10, 15 * 60_000)
 *   if (!rl.allowed) return 429
 *
 * Limites configurées par contexte (voir bas de fichier) :
 *   - login        : 10/15min par email
 *   - register     : 5/h par IP
 *   - password     : 5/h par userId
 *   - export       : 20/h par userId
 *   - import       : 10/h par userId
 *   - search       : 60/min par userId
 *   - api-write    : 200/min par userId (workshop auto-save)
 */

// ── Interface store (prête pour Redis) ────────────────────────────────────────

export interface RateLimitResult {
  allowed:   boolean
  remaining: number
  resetAt:   number
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): RateLimitResult
  reset(key: string): void
}

// ── Store in-memory (défaut) ──────────────────────────────────────────────────

interface MemEntry {
  count:  number
  resetAt: number
}

class InMemoryStore implements RateLimitStore {
  private readonly map = new Map<string, MemEntry>()
  private cleanupTimer: ReturnType<typeof setInterval>

  constructor() {
    // Nettoyage périodique pour éviter les fuites mémoire
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.map.entries()) {
        if (entry.resetAt < now) this.map.delete(key)
      }
    }, 60_000)
    // Permet à Node.js de se terminer proprement même avec le timer actif
    if (this.cleanupTimer.unref) this.cleanupTimer.unref()
  }

  increment(key: string, windowMs: number, limit = Infinity): RateLimitResult {
    const now = Date.now()
    let entry = this.map.get(key)

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs }
      this.map.set(key, entry)
    }

    entry.count++
    const remaining = Math.max(0, limit - entry.count)
    return { allowed: entry.count <= limit, remaining, resetAt: entry.resetAt }
  }

  reset(key: string): void {
    this.map.delete(key)
  }
}

// ── Store global (remplaçable par Redis) ──────────────────────────────────────

// En production multi-instance : instancier un RedisStore ici et l'exporter
// via RATE_LIMIT_STORE pour que les routes puissent le surcharger.
//
// Exemple d'intégration Redis (à implémenter) :
//   import { createClient } from 'redis'
//   import { RedisRateLimitStore } from '@/lib/rate-limit-redis'
//   const client = createClient({ url: process.env.REDIS_URL })
//   export const RATE_LIMIT_STORE: RateLimitStore = new RedisRateLimitStore(client)

const globalForStore = globalThis as unknown as { __rlStore?: InMemoryStore }
const defaultStore: InMemoryStore = globalForStore.__rlStore ?? new InMemoryStore()
if (process.env.NODE_ENV !== 'production') globalForStore.__rlStore = defaultStore

// ── API publique ──────────────────────────────────────────────────────────────

/**
 * Vérifie et incrémente le compteur pour une clé donnée.
 *
 * @param key      Identifiant unique (ex: "login:email:user@example.com")
 * @param limit    Nombre maximum de requêtes autorisées dans la fenêtre
 * @param windowMs Durée de la fenêtre glissante en millisecondes
 * @param store    Store optionnel (défaut: in-memory)
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  store: RateLimitStore = defaultStore
): RateLimitResult {
  return (store as InMemoryStore).increment(key, windowMs, limit)
}

/**
 * Headers standard HTTP de rate limiting (RFC 6585 + draft RateLimit-*).
 */
export function rateLimitHeaders(remaining: number, resetAt: number): Record<string, string> {
  const retryAfter = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000))
  return {
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset':     String(Math.ceil(resetAt / 1000)),
    'Retry-After':           String(retryAfter),
  }
}

// ── Limites prédéfinies par contexte ─────────────────────────────────────────

/** Rate limit pour la connexion : 10 tentatives / 15 min par email */
export const LIMIT_LOGIN    = { limit: 10,  windowMs: 15 * 60_000 } as const
/** Rate limit pour l'inscription : 5 comptes / heure par IP */
export const LIMIT_REGISTER = { limit: 5,   windowMs: 60 * 60_000 } as const
/** Rate limit pour le changement de mot de passe : 5 / heure par userId */
export const LIMIT_PASSWORD = { limit: 5,   windowMs: 60 * 60_000 } as const
/** Rate limit pour les exports (PDF/Excel/CSV) : 20 / heure par userId */
export const LIMIT_EXPORT   = { limit: 20,  windowMs: 60 * 60_000 } as const
/** Rate limit pour les imports : 10 / heure par userId */
export const LIMIT_IMPORT   = { limit: 10,  windowMs: 60 * 60_000 } as const
/** Rate limit pour la recherche : 60 / minute par userId */
export const LIMIT_SEARCH   = { limit: 60,  windowMs: 60_000 }       as const
/** Rate limit pour les écritures API (auto-save workshop) : 200 / minute par userId */
export const LIMIT_API_WRITE = { limit: 200, windowMs: 60_000 }      as const
/** Rate limit pour les suggestions IA (coût API Anthropic) : 20 / heure par userId */
export const LIMIT_AI       = { limit: 20,  windowMs: 60 * 60_000 } as const
