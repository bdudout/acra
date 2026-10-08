// /api/plans/[id]/lignes/[ligneId]/realisations (lot P4) : propositions, rattachement (même sur une année validée),
// identifiants bornés à l'organisation, rôle préparateur requis.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), config: vi.fn(), plan: vi.fn(), ligne: vi.fn(), update: vi.fn(), missions: vi.fn(), controles: vi.fn(), campagnes: vi.fn(), audit: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '' }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  planProgramme: { findFirst: m.plan }, planLigne: { findFirst: m.ligne, update: m.update },
  auditMission: { findMany: m.missions }, controle: { findMany: m.controles }, campagneControle: { findMany: m.campagnes },
} }))
import { GET, PUT } from '@/app/api/plans/[id]/lignes/[ligneId]/realisations/route'

const params = { params: Promise.resolve({ id: 'p1', ligneId: 'l1' }) }
const put = (body: unknown) => new NextRequest('http://x', { method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'AUDITEUR' })
  m.config.mockResolvedValue({ auditInterneActive: true, planificationConfig: {} })
  m.plan.mockResolvedValue({ id: 'p1', organizationId: 'o1', type: 'AUDIT', mode: 'FIGE' })
  m.ligne.mockResolvedValue({ id: 'l1', annee: 2027, debut: new Date('2027-03-01'), fin: new Date('2027-03-31'), statutManuel: null, cibles: { processus: ['pr1'] }, realisations: [] })
  m.missions.mockResolvedValue([
    { id: 'm1', intitule: 'Audit paie', statut: 'CLOTUREE', dateDebut: new Date('2027-03-05'), dateFin: new Date('2027-03-25'), processusIds: ['pr1'] },
    { id: 'm2', intitule: 'Audit achats', statut: 'PLANIFIEE', dateDebut: new Date('2027-05-05'), dateFin: null, processusIds: ['pr9'] },
  ])
  m.controles.mockResolvedValue([])
  m.campagnes.mockResolvedValue([])
})

describe('réalisations d’une ligne', () => {
  it('propositions : missions de l’année qui partagent un processus', async () => {
    const j = await (await GET(new NextRequest('http://x'), params)).json()
    expect(j.propositions.map((x: { id: string }) => x.id)).toEqual(['m1'])
    expect(j.statut).toBe('A_VENIR') // période future
    expect(j.peutModifier).toBe(true)
  })
  it('rattachement enregistré (identifiants de l’organisation) ; inconnu → 400 ; rôle non préparateur → 403', async () => {
    expect((await PUT(put({ realisations: [{ type: 'MISSION', id: 'm1' }] }), params)).status).toBe(200)
    expect(m.update.mock.calls[0][0].data).toEqual({ realisations: [{ type: 'MISSION', id: 'm1' }] })
    expect((await PUT(put({ realisations: [{ type: 'MISSION', id: 'autre-org' }] }), params)).status).toBe(400)
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
    expect((await PUT(put({ realisations: [] }), params)).status).toBe(403)
  })
  it('ligne d’un autre plan ou d’une autre organisation → 404', async () => {
    m.plan.mockResolvedValue(null)
    expect((await GET(new NextRequest('http://x'), params)).status).toBe(404)
  })
})
