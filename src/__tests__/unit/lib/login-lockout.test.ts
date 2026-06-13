import { describe, it, expect, beforeEach } from 'vitest'
import {
  isLockedOut,
  registerFailure,
  initialState,
  type LockoutPolicy,
  type AttemptState,
  __resetLockoutStore,
  checkLockout,
  recordFailure,
  recordSuccess,
} from '@/lib/login-lockout'

const policy: LockoutPolicy = { maxFailedAttempts: 3, lockoutDurationMinutes: 15 }
const DISABLED: LockoutPolicy = { maxFailedAttempts: 0, lockoutDurationMinutes: 15 }

describe('login-lockout — fonctions pures', () => {
  describe('isLockedOut', () => {
    it('n\'est pas verrouillé sans lockedUntil', () => {
      const s: AttemptState = { failedAttempts: 2, lockedUntil: null }
      expect(isLockedOut(s, 1000).locked).toBe(false)
    })

    it('est verrouillé tant que now < lockedUntil', () => {
      const s: AttemptState = { failedAttempts: 3, lockedUntil: 5000 }
      const r = isLockedOut(s, 1000)
      expect(r.locked).toBe(true)
      expect(r.retryAfterMs).toBe(4000)
    })

    it('n\'est plus verrouillé une fois lockedUntil dépassé', () => {
      const s: AttemptState = { failedAttempts: 3, lockedUntil: 5000 }
      expect(isLockedOut(s, 5000).locked).toBe(false)
      expect(isLockedOut(s, 6000).locked).toBe(false)
    })
  })

  describe('registerFailure', () => {
    it('incrémente le compteur sans verrouiller sous le seuil', () => {
      const s = registerFailure(initialState(), policy, 1000)
      expect(s.failedAttempts).toBe(1)
      expect(s.lockedUntil).toBeNull()
    })

    it('verrouille quand le seuil est atteint', () => {
      let s = initialState()
      s = registerFailure(s, policy, 1000) // 1
      s = registerFailure(s, policy, 1000) // 2
      s = registerFailure(s, policy, 1000) // 3 → lock
      expect(s.failedAttempts).toBe(3)
      expect(s.lockedUntil).toBe(1000 + 15 * 60_000)
    })

    it('ne verrouille jamais si la policy est désactivée (maxFailedAttempts=0)', () => {
      let s = initialState()
      for (let i = 0; i < 10; i++) s = registerFailure(s, DISABLED, 1000)
      expect(s.lockedUntil).toBeNull()
    })
  })
})

describe('login-lockout — tracker in-memory (effets de bord)', () => {
  beforeEach(() => __resetLockoutStore())

  it('verrouille un email après N échecs et le débloque après expiration', () => {
    const email = 'user@example.com'
    const now = 1_000_000
    expect(checkLockout(email, now).locked).toBe(false)

    recordFailure(email, policy, now)
    recordFailure(email, policy, now)
    expect(checkLockout(email, now).locked).toBe(false)

    recordFailure(email, policy, now) // 3e → verrouillé
    const locked = checkLockout(email, now)
    expect(locked.locked).toBe(true)

    // Après la durée de verrouillage
    const after = now + 15 * 60_000 + 1
    expect(checkLockout(email, after).locked).toBe(false)
  })

  it('réinitialise le compteur après un succès', () => {
    const email = 'user2@example.com'
    const now = 2_000_000
    recordFailure(email, policy, now)
    recordFailure(email, policy, now)
    recordSuccess(email)
    recordFailure(email, policy, now) // repart de 1
    expect(checkLockout(email, now).locked).toBe(false)
  })

  it('isole les compteurs par email', () => {
    const now = 3_000_000
    recordFailure('a@x.com', policy, now)
    recordFailure('a@x.com', policy, now)
    recordFailure('a@x.com', policy, now)
    expect(checkLockout('a@x.com', now).locked).toBe(true)
    expect(checkLockout('b@x.com', now).locked).toBe(false)
  })
})
