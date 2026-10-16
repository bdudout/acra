/**
 * login-lockout.ts — Verrouillage de compte après échecs de connexion répétés.
 *
 * Applique la politique configurable par l'administrateur (PasswordPolicy) :
 *  - maxFailedAttempts      : nombre d'échecs consécutifs avant verrouillage (0 = désactivé)
 *  - lockoutDurationMinutes : durée du verrouillage
 *
 * La logique de décision est implémentée en fonctions pures (testables sans DB
 * ni horloge réelle). Le suivi passe par un `LockoutStore` remplaçable, comme le
 * rate-limiter (voir rate-limit.ts) :
 *  - mono-instance (défaut) : `MemoryLockoutStore`, propre à l'instance ;
 *  - multi-instance : `RedisLockoutStore`, injecté au démarrage par
 *    `configureLockoutStore()` quand `REDIS_URL` est défini (lib/shared-store.server.ts).
 *    Sans store partagé, un attaquant répartissant ses essais sur N instances
 *    disposerait de N fois le seuil configuré.
 */
import type { RedisLike } from '@/lib/rate-limit-redis'

export interface LockoutPolicy {
  maxFailedAttempts: number
  lockoutDurationMinutes: number
}

/** État de suivi des tentatives de connexion d'un compte : échecs consécutifs + éventuel verrou jusqu'à une date. */
export interface AttemptState {
  failedAttempts: number
  lockedUntil: number | null // timestamp epoch ms, ou null
}

// ── Fonctions pures ────────────────────────────────────────────────────────────

/** État initial de suivi des tentatives de connexion (0 échec, non verrouillé). */
export function initialState(): AttemptState {
  return { failedAttempts: 0, lockedUntil: null }
}

/** L'état correspond-il à un compte actuellement verrouillé ? */
export function isLockedOut(
  state: AttemptState,
  now: number
): { locked: boolean; retryAfterMs: number } {
  if (state.lockedUntil != null && now < state.lockedUntil) {
    return { locked: true, retryAfterMs: state.lockedUntil - now }
  }
  return { locked: false, retryAfterMs: 0 }
}

/** Calcule le nouvel état après un échec de connexion. */
export function registerFailure(
  state: AttemptState,
  policy: LockoutPolicy,
  now: number
): AttemptState {
  // Policy désactivée : on ne verrouille jamais
  if (!policy.maxFailedAttempts || policy.maxFailedAttempts <= 0) {
    return { failedAttempts: state.failedAttempts + 1, lockedUntil: null }
  }

  const failedAttempts = state.failedAttempts + 1
  if (failedAttempts >= policy.maxFailedAttempts) {
    const durationMs = Math.max(1, policy.lockoutDurationMinutes) * 60_000
    return { failedAttempts, lockedUntil: now + durationMs }
  }
  return { failedAttempts, lockedUntil: null }
}

// ── Stores (effets de bord) ─────────────────────────────────────────────────────

/** Magasin du suivi des échecs de connexion. Asynchrone pour permettre un backend partagé. */
export interface LockoutStore {
  check(key: string, now: number): Promise<{ locked: boolean; retryAfterMs: number }>
  fail(key: string, policy: LockoutPolicy, now: number): Promise<AttemptState>
  success(key: string): Promise<void>
}

/** Store en mémoire (défaut, mono-instance) : non partagé entre instances. */
export class MemoryLockoutStore implements LockoutStore {
  readonly map = new Map<string, AttemptState>()

  async check(key: string, now: number) {
    const state = this.map.get(key)
    if (!state) return { locked: false, retryAfterMs: 0 }
    const result = isLockedOut(state, now)
    // Nettoyage opportuniste : verrouillage expiré → on repart de zéro
    if (!result.locked && state.lockedUntil != null) this.map.delete(key)
    return result
  }

  async fail(key: string, policy: LockoutPolicy, now: number) {
    const next = registerFailure(this.map.get(key) ?? initialState(), policy, now)
    this.map.set(key, next)
    return next
  }

  async success(key: string) {
    this.map.delete(key)
  }
}

/** Durée de vie d'un compteur d'échecs sans verrouillage dans Redis (évite des clés éternelles). */
export const LOCKOUT_FAILURES_TTL_MS = 24 * 60 * 60_000
/** Durée appliquée à un verrou orphelin sans expiration (arrêt entre INCR et PEXPIRE). */
const ORPHAN_LOCK_MS = 15 * 60_000

/**
 * Store PARTAGÉ (multi-instance) sur Redis, avec les seuls primitifs de `RedisLike` :
 *  - `<prefix>f:<email>` : compteur atomique d'échecs consécutifs (INCR), expirant après `failuresTtlMs` ;
 *  - `<prefix>l:<email>` : présence = compte verrouillé, TTL = durée restante du verrouillage.
 * L'atteinte du seuil pose le verrou puis efface le compteur : à l'expiration du verrou, on repart
 * de zéro (même sémantique que le store mémoire). Les échecs concurrents sont comptés sans perte (INCR).
 */
export class RedisLockoutStore implements LockoutStore {
  constructor(
    private readonly redis: RedisLike,
    private readonly prefix = 'lo:',
    private readonly failuresTtlMs = LOCKOUT_FAILURES_TTL_MS,
  ) {}

  private failKey(key: string) { return `${this.prefix}f:${key}` }
  private lockKey(key: string) { return `${this.prefix}l:${key}` }

  /** `_now` ignoré : l'horloge de référence est celle de Redis (TTL). */
  async check(key: string, _now?: number) {
    const ttl = await this.redis.pttl(this.lockKey(key))
    if (ttl > 0) return { locked: true, retryAfterMs: ttl }
    if (ttl === -1) {
      // Verrou sans expiration : on lui en rend une plutôt que de bloquer le compte indéfiniment.
      await this.redis.pexpire(this.lockKey(key), ORPHAN_LOCK_MS)
      return { locked: true, retryAfterMs: ORPHAN_LOCK_MS }
    }
    return { locked: false, retryAfterMs: 0 }
  }

  async fail(key: string, policy: LockoutPolicy, now: number): Promise<AttemptState> {
    const fk = this.failKey(key)
    const failedAttempts = await this.redis.incr(fk)
    if (failedAttempts === 1) await this.redis.pexpire(fk, this.failuresTtlMs)
    if (!policy.maxFailedAttempts || policy.maxFailedAttempts <= 0 || failedAttempts < policy.maxFailedAttempts) {
      return { failedAttempts, lockedUntil: null }
    }
    const durationMs = Math.max(1, policy.lockoutDurationMinutes) * 60_000
    const lk = this.lockKey(key)
    await this.redis.incr(lk)
    await this.redis.pexpire(lk, durationMs)
    await this.redis.del(fk)
    return { failedAttempts, lockedUntil: now + durationMs }
  }

  async success(key: string) {
    await this.redis.del(this.failKey(key))
    await this.redis.del(this.lockKey(key))
  }
}

// ── Store courant + injection (point de résolution UNIQUE) ──────────────────────

const globalForLockout = globalThis as unknown as { __lockoutStore?: MemoryLockoutStore }
function defaultMemoryStore(): MemoryLockoutStore {
  const s = globalForLockout.__lockoutStore ?? new MemoryLockoutStore()
  // Toujours mémorisé (résolu à chaque appel par le getter) ; survit aussi au HMR en développement.
  globalForLockout.__lockoutStore = s
  return s
}

// Rangé sur `globalThis` (comme rate-limit.ts) : instrumentation.ts et les routes peuvent être des bundles distincts.
const SLOT = Symbol.for('acra.lockoutStore')
const slot = globalThis as unknown as { [SLOT]?: LockoutStore }

/** Remplace le store de verrouillage (au démarrage, en multi-instance). `null` rétablit la mémoire. */
export function configureLockoutStore(store: LockoutStore | null): void {
  if (store) slot[SLOT] = store
  else delete slot[SLOT]
}

/** Store de verrouillage actuellement utilisé. */
export function getLockoutStore(): LockoutStore {
  return slot[SLOT] ?? defaultMemoryStore()
}

function keyFor(email: string): string {
  return email.toLowerCase().trim()
}

/** Vérifie si l'email est actuellement verrouillé. */
export function checkLockout(email: string, now: number = Date.now()) {
  return getLockoutStore().check(keyFor(email), now)
}

/** Enregistre un échec de connexion pour l'email et applique la policy. */
export function recordFailure(email: string, policy: LockoutPolicy, now: number = Date.now()) {
  return getLockoutStore().fail(keyFor(email), policy, now)
}

/** Réinitialise le compteur après une connexion réussie. */
export function recordSuccess(email: string) {
  return getLockoutStore().success(keyFor(email))
}

/** Réinitialise le store mémoire — réservé aux tests. */
export function __resetLockoutStore() {
  configureLockoutStore(null)
  ;(getLockoutStore() as MemoryLockoutStore).map.clear()
}
