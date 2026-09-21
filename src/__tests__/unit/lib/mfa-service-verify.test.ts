/**
 * F05 (CWE-362) — la consommation d'un OTP doit être ATOMIQUE (usage unique)
 * même sous concurrence. Deux vérifications simultanées du même code ne doivent
 * réussir qu'UNE seule fois.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'

const { updateMany, state } = vi.hoisted(() => {
  const state = { consumed: false }
  const updateMany = vi.fn(async ({ where }: { where: { consumedAt: unknown } }) => {
    // Simule l'écriture conditionnelle Postgres : ne bascule consumedAt (null→date)
    // qu'une seule fois. Toute course perdante voit consumedAt déjà posé → count 0.
    if (where?.consumedAt === null && !state.consumed) { state.consumed = true; return { count: 1 } }
    return { count: 0 }
  })
  return { updateMany, state }
})

vi.mock('@/lib/mfa', () => ({
  verifyCode: () => true,          // code correct
  isExpired: () => false,          // non expiré
  generateCode: () => '123456',
  hashCode: () => 'h',
  MFA_TTL_MS: 600_000,
  MFA_MAX_ATTEMPTS: 5,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    mfaChallenge: {
      findFirst: vi.fn(async () => ({ id: 'ch', expiresAt: new Date(Date.now() + 60_000), attempts: 0, codeHash: 'h', consumedAt: null })),
      updateMany,
      update: vi.fn(async () => ({ attempts: 1 })),
    },
  },
}))
vi.mock('@/lib/sms', () => ({ sendSms: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }))
vi.mock('@/lib/email-html', () => ({ emailLayout: vi.fn() }))

import { verifyChallenge } from '@/lib/mfa-service'

beforeEach(() => { state.consumed = false; updateMany.mockClear() })

describe('verifyChallenge — usage unique atomique (F05)', () => {
  it('deux vérifications concurrentes du même code → exactement UNE réussite', async () => {
    const [a, b] = await Promise.all([
      verifyChallenge('u', '123456'),
      verifyChallenge('u', '123456'),
    ])
    expect([a.ok, b.ok].filter(Boolean).length).toBe(1)
    expect(updateMany).toHaveBeenCalledTimes(2) // les deux tentent, une seule bascule
  })

  it('une vérification unique du bon code réussit', async () => {
    const r = await verifyChallenge('u', '123456')
    expect(r.ok).toBe(true)
  })
})
