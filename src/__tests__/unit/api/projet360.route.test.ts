/**
 * Analyse projet 360 : import de risques cyber (source filtrée par périmètre,
 * organisation et méthode cyber ; idempotent) et questionnaire 360 (fusion des
 * seules réponses p360.* sans écraser le questionnaire général).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const guard = vi.hoisted(() => ({ result: { ok: true, analyse: { id: 'p1', organizationId: 'org1', methode: 'PROJET_360' } } as unknown }))
const db = vi.hoisted(() => ({
  analyse: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  risque: { findMany: vi.fn(), createMany: vi.fn() },
}))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/analyse-direct-risk.server', () => ({ guardDirectRisk: vi.fn(async () => guard.result) }))
vi.mock('@/lib/org-context.server', () => ({
  getEffectiveRoleForOrg: vi.fn(async () => 'ANALYSTE'),
}))
vi.mock('@/lib/permissions', async (orig) => ({ ...(await orig() as object), analyseWhereClause: vi.fn(() => ({ scope: 'visible' })) }))
vi.mock('@/lib/configuration-server', () => ({ getEffectiveScaleConfig: vi.fn(async () => ({ nbNiveaux: 4 })) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: () => '' }))

import { GET, POST } from '@/app/api/analyses/[id]/import-cyber/route'
import { PUT } from '@/app/api/analyses/[id]/qualification-360/route'
import { getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { analyseWhereClause } from '@/lib/permissions'

const params = { params: Promise.resolve({ id: 'p1' }) }
const req = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as never
const risque = (id: string) => ({ id, nom: id, description: null, gravite: 3, vraisemblance: 3, graviteActuelle: null, vraisemblanceActuelle: null, graviteResiduelle: null, vraisemblanceResiduelle: null, strategie: 'REDUIRE', proprietaire: null, taxonomieCode: null, niveauRisque: 9 })

beforeEach(() => {
  vi.clearAllMocks()
  guard.result = { ok: true, analyse: { id: 'p1', organizationId: 'org1', methode: 'PROJET_360' } }
  db.risque.findMany.mockResolvedValue([{ sourceRisqueId: 's1' }])
  db.risque.createMany.mockImplementation(async (a: { data: unknown[] }) => ({ count: a.data.length }))
})

describe('import-cyber', () => {
  it('les sources sont filtrées : même organisation, méthodes cyber, périmètre visible, hors analyse cible', async () => {
    db.analyse.findMany.mockResolvedValue([{ id: 'c1', nom: 'EBIOS', methode: 'EBIOS_RM', updatedAt: new Date(), risques: [risque('s1'), risque('s2')] }])
    const res = await GET(req({}), params)
    const where = db.analyse.findMany.mock.calls[0][0].where
    expect(where).toMatchObject({ organizationId: 'org1', deletedAt: null, NOT: { id: 'p1' }, AND: [{ scope: 'visible' }] })
    expect(where.methode.in).toEqual(expect.arrayContaining(['EBIOS_RM', 'ISO_27005', 'NIST_800_30']))
    expect(where.methode.in).not.toContain('ISO_31000')
    const d = await res.json()
    expect(d.sources[0].risques.map((r: { id: string; alreadyImported: boolean }) => [r.id, r.alreadyImported])).toEqual([['s1', true], ['s2', false]])
  })

  it('utilise le rôle effectif dans l’organisation cible et non celui de la session ou de l’organisation active', async () => {
    vi.mocked(getEffectiveRoleForOrg).mockResolvedValueOnce('LECTEUR')
    db.analyse.findMany.mockResolvedValue([])
    await GET(req({}), params)
    expect(analyseWhereClause).toHaveBeenCalledWith('u1', 'LECTEUR', {
      visibleOrgIds: ['org1'], isSuperAdmin: false,
    })
  })

  it('import : source hors filtre (autre org, non visible) → 404', async () => {
    db.analyse.findFirst.mockResolvedValue(null)
    const res = await POST(req({ sourceAnalyseId: 'autre', risqueIds: ['x'] }), params)
    expect(res.status).toBe(404)
    expect(db.analyse.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'autre', organizationId: 'org1' })
    expect(db.risque.createMany).not.toHaveBeenCalled()
  })

  it('import : copie la sélection en CYBER, sans réimporter un risque déjà importé', async () => {
    db.analyse.findFirst.mockResolvedValue({ id: 'c1', nom: 'EBIOS', risques: [risque('s1'), risque('s2')] })
    const res = await POST(req({ sourceAnalyseId: 'c1', risqueIds: ['s1', 's2'] }), params)
    expect(res.status).toBe(201)
    const rows = db.risque.createMany.mock.calls[0][0].data
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ analyseId: 'p1', domaine: 'CYBER', sourceRisqueId: 's2', sourceAnalyseId: 'c1', niveauRisque: 9 })
    expect(db.risque.createMany.mock.calls[0][0].skipDuplicates).toBe(true)
  })

  it('cible non 360 → 400 ; garde refusée (gel, droits) → statut de la garde', async () => {
    guard.result = { ok: true, analyse: { id: 'p1', organizationId: 'org1', methode: 'ISO_31000' } }
    expect((await GET(req({}), params)).status).toBe(400)
    guard.result = { ok: false, status: 403, error: 'ANALYSE_GELEE' }
    expect((await POST(req({}), params)).status).toBe(403)
  })

  it('refuse une cible historique sans organisation plutôt que d’élargir la recherche de sources', async () => {
    guard.result = { ok: true, analyse: { id: 'p1', organizationId: null, methode: 'PROJET_360' } }
    const res = await GET(req({}), params)
    expect(res.status).toBe(400)
    expect(db.analyse.findMany).not.toHaveBeenCalled()
  })
})

describe('qualification-360', () => {
  it('fusionne les réponses p360.* et conserve le questionnaire général', async () => {
    db.analyse.findUnique.mockResolvedValue({ qualification: { externalisation: true, 'p360.it.obsolescence': true } })
    const res = await PUT(req({ answers: { 'p360.cyber.exposeInternet': true, 'p360.inconnue': true, externalisation: false } }), params)
    expect(res.status).toBe(200)
    const q = db.analyse.update.mock.calls[0][0].data.qualification
    expect(q).toEqual({ externalisation: true, 'p360.cyber.exposeInternet': true })
    const d = await res.json()
    expect(d.progression.CYBER.answered).toBe(1)
  })
})
