// Programme d'audit et de contrôle (lot P1) — routes : isolation par organisation et par module, droits de préparation,
// lignes verrouillées après validation (plan figé), cycle de validation (contenu figé, double regard, concurrence).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  session: vi.fn(), scope: vi.fn(), config: vi.fn(), audit: vi.fn(),
  planFind: vi.fn(), planCreate: vi.fn(), planFindMany: vi.fn(),
  anneeFind: vi.fn(), anneeFindMany: vi.fn(), anneeCreateMany: vi.fn(), anneeUpdateMany: vi.fn(),
  ligneCreate: vi.fn(), ligneFindMany: vi.fn(),
}))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '' }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: async () => ({ allowed: true }), LIMIT_API_WRITE: { limit: 9, windowMs: 1 } }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  planProgramme: { findFirst: m.planFind, create: m.planCreate, findMany: m.planFindMany },
  planAnnee: { findUnique: m.anneeFind, findMany: m.anneeFindMany, createMany: m.anneeCreateMany, updateMany: m.anneeUpdateMany },
  planLigne: { create: m.ligneCreate, findMany: m.ligneFindMany },
} }))

import { GET as LISTE, POST as CREER } from '@/app/api/plans/route'
import { POST as AJOUTER } from '@/app/api/plans/[id]/lignes/route'
import { PATCH as TRANSITION } from '@/app/api/plans/[id]/annees/[annee]/route'

const req = (url: string, body?: unknown) => new NextRequest(url, body ? { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : undefined)
const PLAN = { id: 'p1', organizationId: 'o1', type: 'AUDIT', nom: 'Audit SI', mode: 'FIGE', prismePrincipal: 'PROCESSUS', anneeDebut: 2027, anneeFin: 2029 }
const ANNEE = (o = {}) => ({ id: 'a1', planId: 'p1', annee: 2027, statut: 'BROUILLON', preparePar: null, revision: 0, historique: [], ...o })
const pid = { params: Promise.resolve({ id: 'p1' }) }
const pan = { params: Promise.resolve({ id: 'p1', annee: '2027' }) }

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'AUDITEUR' })
  m.config.mockResolvedValue({ auditInterneActive: true, controlePermanentActive: false, planificationConfig: {} })
  m.planFind.mockResolvedValue({ ...PLAN })
  m.planCreate.mockImplementation(async (a: { data: object }) => ({ id: 'p1', ...a.data }))
  m.planFindMany.mockResolvedValue([])
  m.anneeFind.mockResolvedValue(ANNEE())
  m.anneeFindMany.mockResolvedValue([])
  m.anneeUpdateMany.mockResolvedValue({ count: 1 })
  m.ligneCreate.mockImplementation(async (a: { data: object }) => ({ id: 'l1', ...a.data }))
  m.ligneFindMany.mockResolvedValue([{ id: 'l1', intitule: 'Accès', prisme: 'RISQUE', cibles: { risques: ['r1'] }, echantillon: null, debut: new Date('2027-03-01'), fin: null, charge: 5, priorite: 1, responsable: null, statutManuel: null }])
})

describe('plans : lecture, création, isolation', () => {
  it('rôle sans lecture globale du dispositif → 403 ; aucun module d’audit ni de contrôle → 404', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'METIER' })
    expect((await LISTE(req('http://x/api/plans'))).status).toBe(403)
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'AUDITEUR' }); m.config.mockResolvedValue({ auditInterneActive: false, controlePermanentActive: false })
    expect((await LISTE(req('http://x/api/plans'))).status).toBe(404)
  })
  it('liste bornée à l’organisation active et aux modules actifs', async () => {
    const j = await (await LISTE(req('http://x/api/plans'))).json()
    expect(m.planFindMany.mock.calls[0][0].where).toEqual({ organizationId: 'o1', type: { in: ['AUDIT'] } })
    expect(j.peutCreer).toEqual({ AUDIT: true, CONTROLE: false })
  })
  it('création : préparateur du type, module actif, années de l’horizon créées en brouillon', async () => {
    const r = await CREER(req('http://x/api/plans', { nom: 'Audit SI', type: 'AUDIT', anneeDebut: 2027, anneeFin: 2029, organizationId: 'autre' }))
    expect(r.status).toBe(201)
    expect(m.planCreate.mock.calls[0][0].data).toMatchObject({ organizationId: 'o1', createdById: 'u1', mode: 'FIGE' })
    expect(m.anneeCreateMany.mock.calls[0][0].data.map((a: { annee: number }) => a.annee)).toEqual([2027, 2028, 2029])
    expect((await CREER(req('http://x/api/plans', { nom: 'C', type: 'CONTROLE' }))).status).toBe(404)
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
    expect((await CREER(req('http://x/api/plans', { nom: 'A', type: 'AUDIT' }))).status).toBe(403)
  })
})

describe('lignes', () => {
  it('plan d’une autre organisation → 404 ; année validée d’un plan figé → 409 ; sinon créée dans l’année', async () => {
    m.planFind.mockResolvedValueOnce(null)
    expect((await AJOUTER(req('http://x', { annee: 2027, intitule: 'A' }), pid)).status).toBe(404)
    m.anneeFind.mockResolvedValueOnce(ANNEE({ statut: 'VALIDE' }))
    expect((await AJOUTER(req('http://x', { annee: 2027, intitule: 'A' }), pid)).status).toBe(409)
    const ok = await AJOUTER(req('http://x', { annee: 2027, intitule: 'Accès', cibles: { risques: ['r1'] }, debut: '2027-03-01' }), pid)
    expect(ok.status).toBe(201)
    expect(m.ligneCreate.mock.calls[0][0].data).toMatchObject({ planId: 'p1', annee: 2027, intitule: 'Accès', prisme: 'PROCESSUS', cibles: { risques: ['r1'] } })
  })
})

describe('cycle de validation de l’année', () => {
  const patch = (body: unknown) => new NextRequest('http://x', { method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
  it('soumission par le préparateur, conditionnée au statut lu', async () => {
    expect((await TRANSITION(patch({ action: 'SOUMETTRE' }), pan)).status).toBe(200)
    expect(m.anneeUpdateMany.mock.calls[0][0].where).toEqual({ id: 'a1', statut: 'BROUILLON' })
    expect(m.anneeUpdateMany.mock.calls[0][0].data).toMatchObject({ statut: 'SOUMIS', preparePar: 'u1' })
    m.anneeUpdateMany.mockResolvedValueOnce({ count: 0 })
    expect((await TRANSITION(patch({ action: 'SOUMETTRE' }), pan)).status).toBe(409)
  })
  it('validation par la direction : lignes figées, historique ; double regard actif → refus du préparateur', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'DIRECTION_METIER' }); m.session.mockResolvedValue({ user: { id: 'd1' } })
    m.anneeFind.mockResolvedValue(ANNEE({ statut: 'SOUMIS', preparePar: 'u1' }))
    expect((await TRANSITION(patch({ action: 'VALIDER', commentaire: 'Comité du 12/12' }), pan)).status).toBe(200)
    const data = m.anneeUpdateMany.mock.calls[0][0].data
    expect(data).toMatchObject({ statut: 'VALIDE', validePar: 'd1', commentaire: 'Comité du 12/12' })
    expect(data.contenu).toEqual([expect.objectContaining({ id: 'l1', intitule: 'Accès', debut: '2027-03-01' })])
    expect(data.historique).toEqual([expect.objectContaining({ action: 'VALIDER', statut: 'VALIDE', par: 'd1' })])
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'ADMIN' }); m.session.mockResolvedValue({ user: { id: 'u1' } })
    m.config.mockResolvedValue({ auditInterneActive: true, planificationConfig: { doubleRegard: true } })
    expect((await TRANSITION(patch({ action: 'VALIDER' }), pan)).status).toBe(403)
  })
  it('révision d’un plan figé : motif obligatoire, compteur de révision incrémenté', async () => {
    m.anneeFind.mockResolvedValue(ANNEE({ statut: 'VALIDE', revision: 1 }))
    expect((await TRANSITION(patch({ action: 'REVISER' }), pan)).status).toBe(400)
    expect((await TRANSITION(patch({ action: 'REVISER', motif: 'Acquisition' }), pan)).status).toBe(200)
    expect(m.anneeUpdateMany.mock.calls[0][0].data).toMatchObject({ statut: 'REVISION', revision: 2, motifRevision: 'Acquisition' })
  })
})
