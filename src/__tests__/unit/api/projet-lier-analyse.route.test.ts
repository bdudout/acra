/** Lier une analyse cyber existante à un projet 360 : édition du projet ET de l'analyse, même organisation. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  session: vi.fn(), guard: vi.fn(), audit: vi.fn(),
  analyse: { findFirst: vi.fn(), update: vi.fn() },
}))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { analyse: m.analyse } }))
vi.mock('@/lib/analyse-direct-risk.server', () => ({ guardDirectRisk: m.guard }))
vi.mock('@/lib/projet360-sources.server', () => ({ sourcesCyberWhere: vi.fn(async () => ({ organizationId: 'o1', methode: { in: ['EBIOS_RM'] }, deletedAt: null, NOT: { id: 'p' } })) }))
vi.mock('@/lib/org-context.server', () => ({ getEffectiveRoleForOrg: vi.fn(async () => 'ANALYSTE') }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '' }))

import { POST } from '@/app/api/projets/[id]/analyses/route'

const params = { params: Promise.resolve({ id: 'p' }) }
const req = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as never
beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u', role: 'ANALYSTE' } })
  m.guard.mockResolvedValue({ ok: true, analyse: { id: 'p', organizationId: 'o1', methode: 'PROJET_360' }, role: 'ANALYSTE' })
})

describe('POST /api/projets/[id]/analyses', () => {
  it('lie l’analyse (accessible, cyber, même organisation, éditable) et trace', async () => {
    m.analyse.findFirst.mockResolvedValue({ id: 'a1', nom: 'Cyber', userId: 'u', accesUtilisateurs: [] })
    const r = await POST(req({ analyseId: 'a1' }), params)
    expect(r.status).toBe(200)
    expect(m.analyse.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'a1', organizationId: 'o1' })
    expect(m.analyse.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { projetSourceId: 'p' } })
    expect(m.audit).toHaveBeenCalled()
  })
  it('projet non éditable : refus ; analyse introuvable : 404 ; analyse non éditable : 403', async () => {
    m.guard.mockResolvedValueOnce({ ok: false, status: 403, error: 'x' })
    expect((await POST(req({ analyseId: 'a1' }), params)).status).toBe(403)
    m.analyse.findFirst.mockResolvedValueOnce(null)
    expect((await POST(req({ analyseId: 'a1' }), params)).status).toBe(404)
    m.analyse.findFirst.mockResolvedValueOnce({ id: 'a1', nom: 'Cyber', userId: 'autre', accesUtilisateurs: [] })
    expect((await POST(req({ analyseId: 'a1' }), params)).status).toBe(403)
    expect(m.analyse.update).not.toHaveBeenCalled()
  })
})
