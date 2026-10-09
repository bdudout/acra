// @vitest-environment node
// Vue inverse (tiers) : services tiers dont l'évaluation est rattachée à un risque du registre — risque dans le périmètre
// de l'utilisateur seulement (404 sinon), évaluations de la même organisation que le risque.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), cfg: vi.fn(), risk: vi.fn(), evals: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.cfg }))
vi.mock('@/lib/prisma', () => ({ prisma: { riskItem: { findFirst: m.risk }, evaluationUsageTiers: { findMany: m.evals } } }))
import { GET } from '@/app/api/risk-items/[id]/tiers/route'

const p = { params: Promise.resolve({ id: 'r1' }) }
beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ role: 'RISK_MANAGER', activeOrgId: 'org1', scope: { visibleOrgIds: ['org1'], isSuperAdmin: false } })
  m.cfg.mockResolvedValue({ registreRisquesActive: true, echellesEcosysteme: null })
  m.risk.mockResolvedValue({ id: 'r1', organizationId: 'org1' })
  m.evals.mockResolvedValue([{ statut: 'VALIDEE', actuelle: { dependance: 4, penetration: 3, maturite: 2, confiance: 2 }, cible: { dependance: 4, penetration: 2, maturite: 3, confiance: 3 }, usage: { useCase: 'Paie', tierService: { nom: 'IaaS', tier: { nom: 'Hébergeur' } } } }])
})

describe('GET /api/risk-items/[id]/tiers', () => {
  it('services tiers rattachés avec zone actuelle et cible ; recherche bornée à l’organisation du risque', async () => {
    const j = await (await GET(new NextRequest('http://x'), p)).json()
    expect(j.services).toEqual([{ tiers: 'Hébergeur', offre: 'IaaS', usage: 'Paie', statut: 'VALIDEE', actuelle: { menace: 3, zone: 'danger' }, cible: { menace: 8 / 9, zone: 'veille' } }])
    expect(m.evals.mock.calls[0][0].where).toEqual({ organizationId: 'org1', risqueIds: { array_contains: ['r1'] } })
    expect(m.risk.mock.calls[0][0].where).toMatchObject({ id: 'r1', organizationId: { in: ['org1'] } })
  })
  it('risque hors périmètre : 404', async () => {
    m.risk.mockResolvedValue(null)
    expect((await GET(new NextRequest('http://x'), p)).status).toBe(404)
  })
})
