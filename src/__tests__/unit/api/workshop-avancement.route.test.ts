// @vitest-environment node
// Recette n° 14 : la sauvegarde d'un atelier (PUT, y compris automatique) ne fait plus avancer l'atelier courant ; seul
// POST (« Passer à l'atelier suivant ») le fait, avec les mêmes contrôles d'accès que la sauvegarde.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), upsert: vi.fn(), role: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'auteur', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { analyse: { findFirst: m.find, update: m.update }, cadrage: { upsert: m.upsert } } }))
vi.mock('@/lib/org-context.server', () => ({ analyseAccessWhere: vi.fn(async () => ({})), getEffectiveRoleForOrg: m.role }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ gelApresAcceptationActive: false })) }))
vi.mock('@/lib/demo-server', () => ({ touchOrgActivity: vi.fn(async () => {}) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn(() => '') }))
import { POST, PUT } from '@/app/api/analyses/[id]/workshop/[num]/route'

const p = (num: string) => ({ params: Promise.resolve({ id: 'a1', num }) })
const ANALYSE = { id: 'a1', userId: 'auteur', organizationId: 'org1', statut: 'EN_COURS', atelierCourant: 1, deletedAt: null, risquesResiduelsStatut: null, accesUtilisateurs: [] }
beforeEach(() => {
  vi.clearAllMocks()
  m.find.mockResolvedValue(ANALYSE)
  m.role.mockResolvedValue('ANALYSTE')
  m.update.mockResolvedValue({})
  m.upsert.mockResolvedValue({})
})

describe('avancement d’une analyse', () => {
  it('PUT (sauvegarde de l’atelier 1) : aucune modification de l’atelier courant', async () => {
    const res = await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify({ perimetre: '' }) }), p('1'))
    expect(res.status).toBe(200)
    for (const c of m.update.mock.calls) expect((c[0] as { data: Record<string, unknown> }).data).not.toHaveProperty('atelierCourant')
  })
  it('POST : passe à l’atelier suivant, jamais en arrière', async () => {
    expect(await (await POST(new NextRequest('http://x', { method: 'POST' }), p('1'))).json()).toEqual({ ok: true, atelierCourant: 2 })
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { atelierCourant: 2 } })
    m.find.mockResolvedValue({ ...ANALYSE, atelierCourant: 4 }); m.update.mockClear()
    expect(await (await POST(new NextRequest('http://x', { method: 'POST' }), p('2'))).json()).toEqual({ ok: true, atelierCourant: 4 })
    expect(m.update).not.toHaveBeenCalled()
  })
  it('POST sans droit d’édition : 403 ; analyse approuvée : 403', async () => {
    m.find.mockResolvedValue({ ...ANALYSE, userId: 'autre' }); m.role.mockResolvedValue('LECTEUR')
    expect((await POST(new NextRequest('http://x', { method: 'POST' }), p('1'))).status).toBe(403)
    m.find.mockResolvedValue({ ...ANALYSE, statut: 'APPROUVE' }); m.role.mockResolvedValue('ANALYSTE')
    expect((await POST(new NextRequest('http://x', { method: 'POST' }), p('1'))).status).toBe(403)
  })
})
