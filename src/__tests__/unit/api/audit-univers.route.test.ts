/** /api/audit/univers, /api/audit/plan, /api/audit/missions/[id]/independance. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  session: vi.fn(), scope: vi.fn(), config: vi.fn(), audit: vi.fn(),
  uFind: vi.fn(), uCreate: vi.fn(), uFindFirst: vi.fn(), uUpdate: vi.fn(), uDelete: vi.fn(), mFind: vi.fn(), mFindFirst: vi.fn(), mUpdate: vi.fn(), pFind: vi.fn(),
}))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  auditUnivers: { findMany: m.uFind, create: m.uCreate, findFirst: m.uFindFirst, update: m.uUpdate, delete: m.uDelete },
  auditMission: { findMany: m.mFind, findFirst: m.mFindFirst, update: m.mUpdate },
  processus: { findFirst: m.pFind },
} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))

import { GET as GET_UNIVERS, POST as POST_UNIVERS } from '@/app/api/audit/univers/route'
import { PATCH as PATCH_UNIVERS, DELETE as DELETE_UNIVERS } from '@/app/api/audit/univers/[id]/route'
import { GET as GET_PLAN } from '@/app/api/audit/plan/route'
import { POST as POST_INDEP } from '@/app/api/audit/missions/[id]/independance/route'

const json = (url: string, method: string, body?: unknown) => new NextRequest(`http://x${url}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) })
const p = (id: string) => ({ params: Promise.resolve({ id }) })
const scope = (role: string) => ({ activeOrgId: 'o1', role, scope: { isSuperAdmin: false, visibleOrgIds: ['o1'] } })

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue(scope('AUDITEUR'))
  m.config.mockResolvedValue({ auditInterneActive: true })
  m.uFind.mockResolvedValue([{ id: 'u1', intitule: 'Paiements', type: 'PROCESSUS', risque: 4, cycleAns: null, actif: true, processusId: 'p1', commentaire: null }])
  m.mFind.mockResolvedValue([{ id: 'm1', intitule: 'Audit paiements', statut: 'CLOTUREE', dateDebut: new Date('2025-02-01'), dateFin: new Date('2025-03-01'), processusIds: ['p1'], universIds: [] }])
  m.uCreate.mockImplementation(async (a: { data: object }) => ({ id: 'u9', ...a.data }))
  m.uFindFirst.mockResolvedValue({ id: 'u1', organizationId: 'o1' })
  m.uUpdate.mockImplementation(async (a: { data: object }) => ({ id: 'u1', ...a.data }))
  m.mFindFirst.mockResolvedValue({ id: 'm1', organizationId: 'o1' })
  m.mUpdate.mockImplementation(async (a: { data: object }) => ({ id: 'm1', ...a.data }))
  m.pFind.mockResolvedValue({ id: 'p1' })
})

describe('univers d’audit', () => {
  it('lecture pour tous les rôles de l’organisation ; module inactif → liste vide', async () => {
    m.scope.mockResolvedValue(scope('LECTEUR'))
    expect((await (await GET_UNIVERS()).json()).univers).toHaveLength(1)
    m.config.mockResolvedValue({ auditInterneActive: false })
    expect((await (await GET_UNIVERS()).json()).active).toBe(false)
  })
  it('création réservée à l’audit ; entrée nettoyée, processus vérifié dans l’organisation', async () => {
    m.scope.mockResolvedValue(scope('RSSI'))
    expect((await POST_UNIVERS(json('/api/audit/univers', 'POST', { intitule: 'X' }))).status).toBe(403)
    m.scope.mockResolvedValue(scope('AUDITEUR'))
    expect((await POST_UNIVERS(json('/api/audit/univers', 'POST', { intitule: '' }))).status).toBe(400)
    const res = await POST_UNIVERS(json('/api/audit/univers', 'POST', { intitule: ' Paiements ', type: 'PROCESSUS', risque: 4, processusId: 'p1' }))
    expect(res.status).toBe(201)
    expect(m.uCreate.mock.calls[0][0].data).toMatchObject({ organizationId: 'o1', intitule: 'Paiements', risque: 4, processusId: 'p1' })
    m.pFind.mockResolvedValue(null)
    expect((await POST_UNIVERS(json('/api/audit/univers', 'POST', { intitule: 'Y', processusId: 'autre-org' }))).status).toBe(400)
  })
  it('modification et suppression : 404 hors organisation, 403 sans droit', async () => {
    expect((await PATCH_UNIVERS(json('/api/audit/univers/u1', 'PATCH', { intitule: 'Z', risque: 3 }), p('u1'))).status).toBe(200)
    expect(m.uFindFirst.mock.calls[0][0].where).toMatchObject({ id: 'u1', organizationId: { in: ['o1'] } })
    m.uFindFirst.mockResolvedValue(null)
    expect((await DELETE_UNIVERS(json('/api/audit/univers/u1', 'DELETE'), p('u1'))).status).toBe(404)
    m.uFindFirst.mockResolvedValue({ id: 'u1', organizationId: 'o1' })
    m.scope.mockResolvedValue(scope('RSSI'))
    expect((await DELETE_UNIVERS(json('/api/audit/univers/u1', 'DELETE'), p('u1'))).status).toBe(403)
  })
})

describe('plan pluriannuel', () => {
  it('calcule couverture et plan par année depuis l’univers et les missions', async () => {
    const j = await (await GET_PLAN(json('/api/audit/plan', 'GET'))).json()
    expect(j.plan.entrees).toHaveLength(1)
    expect(j.plan.entrees[0]).toMatchObject({ universId: 'u1', cycleAns: 1, derniere: '2025-03-01' })
    expect(j.plan.parAnnee.length).toBe(3)
    expect(j.univers[0].intitule).toBe('Paiements')
  })
})

describe('indépendance d’une mission', () => {
  it('déclaration tracée par l’audit ; conflit sans commentaire refusé ; rôle non audit refusé', async () => {
    m.scope.mockResolvedValue(scope('RSSI'))
    expect((await POST_INDEP(json('/api/audit/missions/m1/independance', 'POST', { conflit: false }), p('m1'))).status).toBe(403)
    m.scope.mockResolvedValue(scope('AUDITEUR'))
    expect((await POST_INDEP(json('/api/audit/missions/m1/independance', 'POST', { conflit: true }), p('m1'))).status).toBe(400)
    const res = await POST_INDEP(json('/api/audit/missions/m1/independance', 'POST', { conflit: false }), p('m1'))
    expect(res.status).toBe(200)
    expect(m.mUpdate.mock.calls[0][0].data.independance).toMatchObject({ conflit: false, declarePar: 'u1' })
  })
})
