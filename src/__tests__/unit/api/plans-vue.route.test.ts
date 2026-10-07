// GET /api/plans/vue (lot P5) : lignes de l'année tous plans confondus, dernières couvertures réelles (missions,
// exécutions de contrôle), angles morts et sollicitations ; bornée à l'organisation et aux modules actifs.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), config: vi.fn(), plans: vi.fn(), org: vi.fn(), orgs: vi.fn(), tiers: vi.fn(), risques: vi.fn(), processus: vi.fn(), missions: vi.fn(), controles: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  planProgramme: { findMany: m.plans }, organization: { findUnique: m.org, findMany: m.orgs }, tierOrganization: { findMany: m.tiers },
  riskItem: { findMany: m.risques }, processus: { findMany: m.processus }, auditMission: { findMany: m.missions }, controle: { findMany: m.controles },
} }))
import { GET } from '@/app/api/plans/vue/route'

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
  m.config.mockResolvedValue({ auditInterneActive: true, controlePermanentActive: true, planificationConfig: { seuilAnglesMortsAns: 3 } })
  m.org.mockResolvedValue({ path: '/o1/' })
  m.orgs.mockResolvedValue([{ id: 'f1', nom: 'Filiale Nord' }])
  m.tiers.mockResolvedValue([])
  m.plans.mockResolvedValue([
    { id: 'p1', nom: 'Audit SI', type: 'AUDIT', equipe: null, annees: [{ statut: 'VALIDE' }], lignes: [
      { id: 'l1', annee: 2027, intitule: 'Accès', debut: new Date('2027-03-01'), fin: new Date('2027-03-31'), statutManuel: null, cibles: { organisations: ['f1'], risques: ['r2'] } },
    ] },
    { id: 'p2', nom: 'Contrôle N2', type: 'CONTROLE', equipe: null, annees: [{ statut: 'BROUILLON' }], lignes: [
      { id: 'l2', annee: 2027, intitule: 'Sauvegardes', debut: new Date('2027-03-15'), fin: new Date('2027-04-15'), statutManuel: null, cibles: { organisations: ['f1'] } },
    ] },
  ])
  m.risques.mockResolvedValue([
    { id: 'r1', intitule: 'Fraude', graviteInherente: 4, vraisemblanceInherente: 3, graviteResiduelle: null, vraisemblanceResiduelle: null },
    { id: 'r2', intitule: 'Panne', graviteInherente: 4, vraisemblanceInherente: 4, graviteResiduelle: null, vraisemblanceResiduelle: null },
  ])
  m.processus.mockResolvedValue([{ id: 'pr1', nom: 'Paie', criticite: 4, criticiteDora: null }, { id: 'pr2', nom: 'Achats', criticite: 4, criticiteDora: null }])
  m.missions.mockResolvedValue([{ dateDebut: null, dateFin: new Date(Date.now() - 86400000 * 30), processusIds: ['pr2'] }])
  m.controles.mockResolvedValue([{ riskItemId: 'r1', processusId: null, executions: [{ dateRealisation: new Date(Date.now() - 86400000 * 10) }] }])
})

describe('GET /api/plans/vue', () => {
  it('bornée à l’organisation ; couvertures réelles retirées des angles morts ; ligne prévue signalée ; sollicitation simultanée', async () => {
    const j = await (await GET(new NextRequest('http://x/api/plans/vue?annee=2027'))).json()
    expect(m.plans.mock.calls[0][0].where).toEqual({ organizationId: 'o1', type: { in: ['AUDIT', 'CONTROLE'] } })
    expect(j.annee).toBe(2027)
    expect(j.lignes).toHaveLength(2)
    expect(j.anglesMorts.risques).toEqual([{ id: 'r2', nom: 'Panne', niveau: 16, derniere: null, prevu: true }]) // r1 contrôlé récemment
    expect(j.anglesMorts.processus.map((p: { id: string }) => p.id)).toEqual(['pr1']) // pr2 audité récemment
    expect(j.sollicitations.organisations).toEqual([expect.objectContaining({ id: 'f1', nom: 'Filiale Nord', nombre: 2, simultanee: true })])
    expect(j.plans[0]).toMatchObject({ id: 'p1', statut: 'VALIDE', lignes: 1 })
  })
  it('rôle sans lecture globale → 403', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'METIER' })
    expect((await GET(new NextRequest('http://x/api/plans/vue'))).status).toBe(403)
  })
})
