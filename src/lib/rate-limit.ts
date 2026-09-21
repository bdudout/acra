/**
 * rate-limit.ts — Limiteur de débit avec store remplaçable (single/multi-instance)
 *
 * Deux paliers de déploiement :
 *  - **Mono-instance / développement** : store en mémoire (`InMemoryRateLimitStore`,
 *    défaut). Chaque instance compte pour elle-même.
 *  - **Multi-instance** : un **store partagé** (Redis via `RedisRateLimitStore`,
 *    cf. `rate-limit-redis.ts`) est injecté UNE fois au démarrage par
 *    `configureRateLimitStore(store)`. Aucune route à modifier : `rateLimit()`
 *    délègue toujours au store courant.
 *
 * L'interface `RateLimitStore.hit()` est **asynchrone** (un store distribué fait
 * de l'I/O) et reçoit explicitement la `limit` — l'ancienne interface synchrone
 * masquait la limite derrière un cast et rendait tout store externe inopérant.
 *
 * Usage :
 *   const rl = await rateLimit('login:ip:1.2.3.4', 10, 15 * 60_000)
 *   if (!rl.allowed) return 429
 *
 * Limites prédéfinies par contexte : voir le bas de fichier.
 */

// ── Contrat ───────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed:   boolean
  remaining: number
  resetAt:   number   // epoch ms de réinitialisation de la fenêtre
}

/**
 * Magasin de compteurs de limitation de débit. Implémentations : mémoire (défaut)
 * ou store partagé (Redis…). `hit` incrémente le compteur de `key` sur une fenêtre
 * `windowMs` et décide de l'autorisation vis-à-vis de `limit`. Asynchrone pour
 * permettre un backend distribué.
 */
export interface RateLimitStore {
  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>
  reset(key: string): Promise<void>
}

// ── Store en mémoire (défaut, mono-instance) ─────────────────────────────────

interface MemEntry { count: number; resetAt: number }

/** Store de rate limiting en mémoire (compteur par clé, fenêtre fixe). Non partagé entre instances. */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly map = new Map<string, MemEntry>()
  private readonly cleanupTimer: ReturnType<typeof setInterval>

  constructor() {
    // Nettoyage périodique pour éviter les fuites mémoire (entrées expirées).
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.map.entries()) {
        if (entry.resetAt < now) this.map.delete(key)
      }
    }, 60_000)
    // Ne bloque pas l'arrêt de Node.js.
    if (this.cleanupTimer.unref) this.cleanupTimer.unref()
  }

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now()
    let entry = this.map.get(key)
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs }
      this.map.set(key, entry)
    }
    entry.count++
    const remaining = Number.isFinite(limit) ? Math.max(0, limit - entry.count) : Infinity
    return { allowed: entry.count <= limit, remaining, resetAt: entry.resetAt }
  }

  async reset(key: string): Promise<void> {
    this.map.delete(key)
  }
}

// ── Store courant + injection (point de résolution UNIQUE) ────────────────────

// Persistance du store mémoire à travers les rechargements HMR en développement.
const globalForStore = globalThis as unknown as { __rlStore?: InMemoryRateLimitStore }
function defaultMemoryStore(): InMemoryRateLimitStore {
  const store = globalForStore.__rlStore ?? new InMemoryRateLimitStore()
  if (process.env.NODE_ENV !== 'production') globalForStore.__rlStore = store
  return store
}

let currentStore: RateLimitStore = defaultMemoryStore()

/**
 * Remplace le store de rate limiting (à appeler UNE fois au démarrage en
 * multi-instance, ex. `configureRateLimitStore(new RedisRateLimitStore(client))`).
 * `null` rétablit le store mémoire par défaut (utile en test).
 */
export function configureRateLimitStore(store: RateLimitStore | null): void {
  currentStore = store ?? defaultMemoryStore()
}

/** Store de rate limiting actuellement utilisé. */
export function getRateLimitStore(): RateLimitStore {
  return currentStore
}

// ── API publique ──────────────────────────────────────────────────────────────

/**
 * Vérifie et incrémente le compteur d'une clé. Délègue au store courant (mémoire
 * par défaut, ou store partagé injecté). Asynchrone.
 *
 * @param key      Identifiant unique (ex. "login:email:user@example.com")
 * @param limit    Nombre maximum de requêtes autorisées dans la fenêtre
 * @param windowMs Durée de la fenêtre en millisecondes
 * @param store    Store optionnel (défaut : le store courant)
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  store: RateLimitStore = currentStore
): Promise<RateLimitResult> {
  return store.hit(key, limit, windowMs)
}

/** Headers HTTP standard de rate limiting (RFC 6585 + draft RateLimit-*). */
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
/** Rate limit des appels MCP : 120 messages / minute par clé d'API (`mcp:<keyId>`) */
export const LIMIT_MCP       = { limit: 120, windowMs: 60_000 }      as const
