/**
 * F04 (contre-audit 2026-09-21) — une réinitialisation de mot de passe par un
 * administrateur doit RÉVOQUER les sessions/JWT antérieurs (incrément de
 * `sessionVersion`) ET supprimer les appareils de confiance, comme le changement
 * de mot de passe par l'utilisateur. Un simple `mustChangePassword` ne coupe pas
 * les sessions déjà ouvertes.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'

const actor = vi.hoisted(() => ({ role: 'SUPER_ADMIN', all: true }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'admin1', role: actor.role } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const target = vi.hoisted(() => ({ role: 'ANALYSTE', orgs: ['A'] }))
const userUpdate = vi.fn(async (_args: { data: Record<string, unknown> }) => ({ id: 'target1', name: 'T', email: 't@ex.com', role: 'ANALYSTE', isActive: true }))
const trustedDeleteMany = vi.fn(async () => ({ count: 2 }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(async () => ({ email: 't@ex.com', role: target.role, memberships: target.orgs.map(organizationId => ({ organizationId })) })) },
    passwordPolicy: { findUnique: vi.fn(async () => null) },
    orgMembership: { count: vi.fn(async () => 1) },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({ user: { update: userUpdate }, trustedDevice: { deleteMany: trustedDeleteMany } })),
  },
}))
vi.mock('@/lib/org-context.server', () => ({
  getAnalyseScope: vi.fn(async () => ({ scope: { isSuperAdmin: actor.all, visibleOrgIds: actor.all ? [] : ['A'] }, activeOrgId: null })),
  getAdminScope: vi.fn(async () => ({ all: actor.all, orgIds: actor.all ? [] : ['A'], activeOrgId: null })),
  getAccessibleOrgIds: vi.fn(async () => ({ all: actor.all, ids: actor.all ? [] : ['A'] })),
}))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn(() => '') }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/email-html', () => ({ emailLayout: vi.fn(() => '') }))
vi.mock('@/lib/account-lifecycle', () => ({ deactivateInactiveAccounts: vi.fn() }))

import { PATCH } from '@/app/api/admin/users/route'

const req = (body: unknown) => ({ json: async () => body }) as never

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(actor, { role: 'SUPER_ADMIN', all: true })
  Object.assign(target, { role: 'ANALYSTE', orgs: ['A'] })
})

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

describe('T1 (audit 2026-10-01) — un ADMIN ne prend pas la main sur un compte qu\'il ne gère pas entièrement', () => {
  it('reset-password d\'un SUPER_ADMIN par un ADMIN → 403, aucun mot de passe émis', async () => {
    Object.assign(actor, { role: 'ADMIN', all: false })
    Object.assign(target, { role: 'SUPER_ADMIN', orgs: ['A'] })
    const res = await PATCH(req({ userId: 'target1', action: 'reset-password' }))
    expect(res.status).toBe(403)
    expect((await res.json()).tempPassword).toBeUndefined()
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('reset-password d\'un compte partagé avec une autre organisation → 403', async () => {
    Object.assign(actor, { role: 'ADMIN', all: false })
    Object.assign(target, { role: 'RSSI', orgs: ['A', 'B'] })
    const res = await PATCH(req({ userId: 'target1', action: 'reset-password' }))
    expect(res.status).toBe(403)
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('reset-password d\'un compte entièrement dans le périmètre de l\'ADMIN → autorisé', async () => {
    Object.assign(actor, { role: 'ADMIN', all: false })
    const res = await PATCH(req({ userId: 'target1', action: 'reset-password' }))
    expect(res.status).toBe(200)
  })
})
