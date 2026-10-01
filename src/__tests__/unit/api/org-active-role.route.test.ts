// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ session: vi.fn(), ctx: vi.fn(), accessible: vi.fn(), scope: vi.fn(), findMany: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { organization: { findMany: m.findMany } } }))
vi.mock('@/lib/org-context.server', () => ({ ACTIVE_ORG_COOKIE: 'acra_org', resolveOrgContext: m.ctx, getAccessibleOrgIds: m.accessible, getAnalyseScope: m.scope }))
import { GET } from '@/app/api/org/active/route'

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.ctx.mockResolvedValue({ activeOrgId: 'org1' })
  m.accessible.mockResolvedValue({ all: false, ids: ['org1'] })
  m.findMany.mockResolvedValue([{ id: 'org1', nom: 'Org', path: '/org1/', logo: null }])
})

describe('GET /api/org/active — rôle effectif', () => {
  it('expose le rôle de l’utilisateur DANS l’organisation active (pas son rôle global)', async () => {
    m.scope.mockResolvedValue({ role: 'ADMIN', activeOrgId: 'org1' })
    const body = await (await GET()).json()
    expect(body.activeRole).toBe('ADMIN'); expect(body.activeOrgId).toBe('org1')
    expect(m.scope).toHaveBeenCalledWith('u1', 'ANALYSTE')
  })
  it('sans organisation active : rôle nul', async () => {
    m.scope.mockResolvedValue({ role: null, activeOrgId: null })
    expect((await (await GET()).json()).activeRole).toBeNull()
  })
  it('super-administrateur sans organisation focalisée : reste SUPER_ADMIN', async () => {
    m.session.mockResolvedValue({ user: { id: 'sa', role: 'SUPER_ADMIN' } })
    m.scope.mockResolvedValue({ role: 'SUPER_ADMIN', activeOrgId: null })
    expect((await (await GET()).json()).activeRole).toBe('SUPER_ADMIN')
  })
})
