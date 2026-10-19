import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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
  configureLockoutStore,
  getLockoutStore,
  MemoryLockoutStore,
  RedisLockoutStore,
} from '@/lib/login-lockout'
import type { RedisLike } from '@/lib/rate-limit-redis'

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

  it('verrouille un email après N échecs et le débloque après expiration', async () => {
    const email = 'user@example.com'
    const now = 1_000_000
    expect((await checkLockout(email, now)).locked).toBe(false)

    await recordFailure(email, policy, now)
    await recordFailure(email, policy, now)
    expect((await checkLockout(email, now)).locked).toBe(false)

    await recordFailure(email, policy, now) // 3e → verrouillé
    const locked = await checkLockout(email, now)
    expect(locked.locked).toBe(true)

    // Après la durée de verrouillage
    const after = now + 15 * 60_000 + 1
    expect((await checkLockout(email, after)).locked).toBe(false)
  })

  it('réinitialise le compteur après un succès', async () => {
    const email = 'user2@example.com'
    const now = 2_000_000
    await recordFailure(email, policy, now)
    await recordFailure(email, policy, now)
    await recordSuccess(email)
    await recordFailure(email, policy, now) // repart de 1
    expect((await checkLockout(email, now)).locked).toBe(false)
  })

  it('isole les compteurs par email (casse et espaces ignorés)', async () => {
    const now = 3_000_000
    await recordFailure('a@x.com', policy, now)
    await recordFailure(' A@X.com', policy, now)
    await recordFailure('a@x.com', policy, now)
    expect((await checkLockout('a@x.com', now)).locked).toBe(true)
    expect((await checkLockout('b@x.com', now)).locked).toBe(false)
  })
})

// ── Store partagé (multi-instance) ────────────────────────────────────────────

/** Faux Redis à horloge contrôlée : sémantique INCR / PEXPIRE / PTTL (-2 absente, -1 sans TTL) / DEL / GET. */
function fakeRedis() {
  let clock = 0
  const data = new Map<string, { v: number; exp: number | null }>()
  const live = (k: string) => {
    const e = data.get(k)
    if (e && e.exp != null && e.exp <= clock) { data.delete(k); return undefined }
    return e
  }
  const client: RedisLike = {
    async incr(k) { const e = live(k); const v = (e?.v ?? 0) + 1; data.set(k, { v, exp: e?.exp ?? null }); return v },
    async pexpire(k, ms) { const e = live(k); if (e) e.exp = clock + ms; return e ? 1 : 0 },
    async pttl(k) { const e = live(k); if (!e) return -2; return e.exp == null ? -1 : e.exp - clock },
    async del(k) { return data.delete(k) ? 1 : 0 },
    async get(k) { const e = live(k); return e ? String(e.v) : null },
  }
  return { client, data, advance: (ms: number) => { clock += ms } }
}

describe('login-lockout — store partagé Redis', () => {
  afterEach(() => configureLockoutStore(null))

  it('deux instances partageant le même Redis voient le même verrouillage', async () => {
    const { client } = fakeRedis()
    const instanceA = new RedisLockoutStore(client)
    const instanceB = new RedisLockoutStore(client)
    await instanceA.fail('u@x.com', policy, 0)
    await instanceB.fail('u@x.com', policy, 0)
    expect((await instanceA.check('u@x.com', 0)).locked).toBe(false)
    const st = await instanceB.fail('u@x.com', policy, 0)
    expect(st.lockedUntil).toBe(15 * 60_000)
    const a = await instanceA.check('u@x.com', 0)
    expect(a.locked).toBe(true)
    expect(a.retryAfterMs).toBe(15 * 60_000)
  })

  it('le verrou expire avec le TTL Redis et le compteur repart de zéro', async () => {
    const { client, advance } = fakeRedis()
    const s = new RedisLockoutStore(client)
    for (let i = 0; i < 3; i++) await s.fail('u@x.com', policy, 0)
    expect((await s.check('u@x.com', 0)).locked).toBe(true)
    advance(15 * 60_000 + 1)
    expect((await s.check('u@x.com', 0)).locked).toBe(false)
    const st = await s.fail('u@x.com', policy, 0)
    expect(st).toEqual({ failedAttempts: 1, lockedUntil: null })
  })

  it('les échecs isolés expirent (pas de compteur éternel) et un succès les efface', async () => {
    const { client, data, advance } = fakeRedis()
    const s = new RedisLockoutStore(client, 'lo:', 60_000)
    await s.fail('u@x.com', policy, 0)
    await s.fail('u@x.com', policy, 0)
    advance(60_001)
    expect(await s.fail('u@x.com', policy, 0)).toEqual({ failedAttempts: 1, lockedUntil: null })
    await s.success('u@x.com')
    expect([...data.keys()].filter(k => k.includes('u@x.com'))).toEqual([])
  })

  it('répare un verrou resté sans expiration (arrêt entre INCR et PEXPIRE) au lieu de bloquer à vie', async () => {
    const { client } = fakeRedis()
    const s = new RedisLockoutStore(client)
    await client.incr('lo:l:u@x.com') // verrou orphelin sans TTL
    const r = await s.check('u@x.com', 0)
    expect(r.locked).toBe(true)
    expect(await client.pttl('lo:l:u@x.com')).toBeGreaterThan(0)
  })

  it('politique désactivée : jamais de verrou', async () => {
    const { client } = fakeRedis()
    const s = new RedisLockoutStore(client)
    for (let i = 0; i < 10; i++) await s.fail('u@x.com', DISABLED, 0)
    expect((await s.check('u@x.com', 0)).locked).toBe(false)
  })

  it('configureLockoutStore remplace le store utilisé par checkLockout/recordFailure ; null rétablit la mémoire', async () => {
    const { client } = fakeRedis()
    const shared = new RedisLockoutStore(client)
    configureLockoutStore(shared)
    expect(getLockoutStore()).toBe(shared)
    for (let i = 0; i < 3; i++) await recordFailure('z@x.com', policy, 0)
    expect((await shared.check('z@x.com', 0)).locked).toBe(true)
    configureLockoutStore(null)
    expect(getLockoutStore()).toBeInstanceOf(MemoryLockoutStore)
  })
})
