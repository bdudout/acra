/**
 * F04 (contre-audit 2026-09-21) — une réinitialisation de mot de passe par un
 * administrateur doit RÉVOQUER les sessions/JWT antérieurs (incrément de
 * `sessionVersion`) ET supprimer les appareils de confiance, comme le changement
 * de mot de passe par l'utilisateur. Un simple `mustChangePassword` ne coupe pas
 * les sessions déjà ouvertes.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'admin1', role: 'SUPER_ADMIN' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const userUpdate = vi.fn(async (_args: { data: Record<string, unknown> }) => ({ id: 'target1', name: 'T', email: 't@ex.com', role: 'ANALYSTE', isActive: true }))
const trustedDeleteMany = vi.fn(async () => ({ count: 2 }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(async () => ({ email: 't@ex.com' })) },
    passwordPolicy: { findUnique: vi.fn(async () => null) },
    orgMembership: { count: vi.fn(async () => 1) },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({ user: { update: userUpdate }, trustedDevice: { deleteMany: trustedDeleteMany } })),
  },
}))
vi.mock('@/lib/org-context.server', () => ({
  getAnalyseScope: vi.fn(async () => ({ scope: { isSuperAdmin: true, visibleOrgIds: [] }, activeOrgId: null })),
}))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn(() => '') }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/email-html', () => ({ emailLayout: vi.fn(() => '') }))
vi.mock('@/lib/account-lifecycle', () => ({ deactivateInactiveAccounts: vi.fn() }))

import { PATCH } from '@/app/api/admin/users/route'

const req = (body: unknown) => ({ json: async () => body }) as never

beforeEach(() => { vi.clearAllMocks() })

describe('F04 — réinitialisation admin révoque sessions et appareils', () => {
  it('incrémente sessionVersion et force le changement', async () => {
    const res = await PATCH(req({ userId: 'target1', action: 'reset-password' }))
    expect(res.status).toBe(200)
    expect(userUpdate).toHaveBeenCalledTimes(1)
    const data = userUpdate.mock.calls[0][0].data
    expect(data.sessionVersion).toEqual({ increment: 1 })
    expect(data.mustChangePassword).toBe(true)
  })

  it('supprime les appareils de confiance de la cible', async () => {
    await PATCH(req({ userId: 'target1', action: 'reset-password' }))
    expect(trustedDeleteMany).toHaveBeenCalledWith({ where: { userId: 'target1' } })
  })
})
