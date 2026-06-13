/**
 * login-lockout.ts — Verrouillage de compte après échecs de connexion répétés.
 *
 * Applique la politique configurable par l'administrateur (PasswordPolicy) :
 *  - maxFailedAttempts      : nombre d'échecs consécutifs avant verrouillage (0 = désactivé)
 *  - lockoutDurationMinutes : durée du verrouillage
 *
 * La logique de décision est implémentée en fonctions pures (testables sans DB
 * ni horloge réelle). Un tracker in-memory en assure la persistance au sein
 * d'une instance — cohérent avec l'architecture du rate-limiter (voir rate-limit.ts).
 * En production multi-instance, remplacer le store par Redis.
 */

export interface LockoutPolicy {
  maxFailedAttempts: number
  lockoutDurationMinutes: number
}

export interface AttemptState {
  failedAttempts: number
  lockedUntil: number | null // timestamp epoch ms, ou null
}

// ── Fonctions pures ────────────────────────────────────────────────────────────

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

// ── Tracker in-memory (effets de bord) ──────────────────────────────────────────

const globalForLockout = globalThis as unknown as { __lockoutStore?: Map<string, AttemptState> }
const store: Map<string, AttemptState> = globalForLockout.__lockoutStore ?? new Map()
if (process.env.NODE_ENV !== 'production') globalForLockout.__lockoutStore = store

function keyFor(email: string): string {
  return email.toLowerCase().trim()
}

/** Vérifie si l'email est actuellement verrouillé. */
export function checkLockout(email: string, now: number = Date.now()) {
  const state = store.get(keyFor(email))
  if (!state) return { locked: false, retryAfterMs: 0 }
  const result = isLockedOut(state, now)
  // Nettoyage opportuniste : verrouillage expiré → on repart de zéro
  if (!result.locked && state.lockedUntil != null) {
    store.delete(keyFor(email))
  }
  return result
}

/** Enregistre un échec de connexion pour l'email et applique la policy. */
export function recordFailure(email: string, policy: LockoutPolicy, now: number = Date.now()) {
  const current = store.get(keyFor(email)) ?? initialState()
  const next = registerFailure(current, policy, now)
  store.set(keyFor(email), next)
  return next
}

/** Réinitialise le compteur après une connexion réussie. */
export function recordSuccess(email: string) {
  store.delete(keyFor(email))
}

/** Réinitialise tout le store — réservé aux tests. */
export function __resetLockoutStore() {
  store.clear()
}
