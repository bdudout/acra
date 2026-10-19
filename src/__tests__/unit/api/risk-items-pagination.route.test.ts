/**
 * GET /api/risk-items — liste paginée côté serveur (lot V1) : sans `page`, réponse historique inchangée ;
 * avec `page`, requête légère sur tout le registre (filtres, tri, compteurs) puis détail et jointures
 * (actions, incidents, exécutions de contrôles) des SEULS risques de la page.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

const db = vi.hoisted(() => ({
  riskItem: { findMany: vi.fn() },
  planAction: { findMany: vi.fn(async (_args: Any) => [] as Any[]) },
  incident: { findMany: vi.fn(async (_args: Any) => [] as Any[]) },
  controle: { findMany: vi.fn(async (_args: Any) => [] as Any[]) },
}))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/org-context.server', () => ({
  getAnalyseScope: vi.fn(async () => ({ role: 'ANALYSTE', activeOrgId: 'o', scope: { isSuperAdmin: false, visibleOrgIds: ['o'] }, memberships: [] })),
  getEffectiveRoleForOrg: vi.fn(async () => 'ANALYSTE'),
}))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ registreRisquesActive: true, incidentsActive: true, controlePermanentActive: true })) }))

import { GET } from '@/app/api/risk-items/route'

const get = (qs = '') => GET(new NextRequest(`http://x/api/risk-items${qs}`))
// 120 risques : r0 (élevé, 4×4), r1 (moyen, 2×3), puis faibles ; statut IDENTIFIE sauf tous les 10.
const leger = (i: number) => ({
  id: `r${i}`, intitule: `Risque ${String(i).padStart(3, '0')}`, taxonomieCode: i % 2 ? 'BALE_1' : null, entite: i < 3 ? 'DSI' : null, proprietaire: null,
  statut: i % 10 === 0 ? 'TRAITE' : 'IDENTIFIE', graviteInherente: null, vraisemblanceInherente: null,
  graviteResiduelle: i === 0 ? 4 : i === 1 ? 2 : 1, vraisemblanceResiduelle: i === 0 ? 4 : i === 1 ? 3 : 1,
  processus: i === 5 ? { nom: 'Paiements' } : null,
})
const TOUS = Array.from({ length: 120 }, (_, i) => leger(i))
const detail = (id: string) => ({ ...TOUS.find(r => r.id === id)!, provenance: 'MANUEL', processusId: null, organizationId: 'o' })

beforeEach(() => {
  vi.clearAllMocks()
  db.riskItem.findMany.mockImplementation(async (args: { where: { id?: { in: string[] } }; select?: unknown }) => {
    if (args.where.id) return [...args.where.id.in].reverse().map(detail) // ordre de la base ≠ ordre de la page
    if (args.select) return TOUS
    return TOUS.map(r => detail(r.id))
  })
})

describe('GET /api/risk-items — pagination serveur', () => {
  it('sans `page` : forme historique (tous les risques, sans pagination ni synthèse), jointures sur toute l’organisation', async () => {
    const j = await (await get()).json()
    expect(Object.keys(j).sort()).toEqual(['active', 'risks'])
    expect(j.risks).toHaveLength(120)
    expect(j.risks[0]).toMatchObject({ id: 'r0', niveauResiduel: 16, actionsSummary: { total: 0 }, calibration: { occurrences: 0 }, controleEfficacite: expect.any(Object) })
    expect(db.controle.findMany.mock.calls[0][0].where.riskItemId).toEqual({ not: null })
  })

  it('avec `page` : taille respectée, total, synthèse sur tout le registre, ordre de la page préservé', async () => {
    const j = await (await get('?page=2&taille=25&tri=intitule&ordre=asc')).json()
    expect(j.pagination).toEqual({ page: 2, taille: 25, total: 120, pages: 5 })
    expect(j.risks).toHaveLength(25)
    expect(j.risks.map((r: { intitule: string }) => r.intitule)[0]).toBe('Risque 025')
    expect(j.synthese).toMatchObject({ total: 120, entiteFrequente: 'DSI' })
    expect(j.synthese.valeurs.category).toEqual(['', 'BALE_1'])
    expect(j.synthese.valeurs.statut).toEqual(['IDENTIFIE', 'TRAITE'])
  })

  it('détail et jointures limités aux risques de la page', async () => {
    await get('?page=1&taille=25')
    const detailCall = db.riskItem.findMany.mock.calls.find(c => c[0].where.id)![0]
    expect(detailCall.where).toMatchObject({ organizationId: 'o' })
    expect(detailCall.where.id.in).toHaveLength(25)
    const ids = detailCall.where.id.in
    expect(db.controle.findMany.mock.calls[0][0].where.riskItemId).toEqual({ in: ids })
    expect(db.incident.findMany.mock.calls[0][0].where.OR[0]).toEqual({ riskItemId: { in: ids } })
    expect(db.planAction.findMany.mock.calls[0][0].where.liens.some.targetId).toEqual({ in: ids })
  })

  it('filtres côté serveur : palier de niveau (deep-link), colonne, recherche', async () => {
    expect((await (await get('?page=1&niveau=eleve')).json()).risks.map((r: { id: string }) => r.id)).toEqual(['r0'])
    const parStatut = await (await get(`?page=1&col_statut=${encodeURIComponent(JSON.stringify(['TRAITE']))}`)).json()
    expect(parStatut.pagination.total).toBe(12)
    const parProcessus = await (await get('?page=1&q=paiements')).json()
    expect(parProcessus.risks.map((r: { id: string }) => r.id)).toEqual(['r5'])
    // Le total de la synthèse reste celui du registre.
    expect(parProcessus.synthese.total).toBe(120)
  })

  it('page vide : aucune jointure lue', async () => {
    db.riskItem.findMany.mockImplementation(async () => [])
    const j = await (await get('?page=1')).json()
    expect(j).toMatchObject({ risks: [], pagination: { total: 0, pages: 1 } })
    expect(db.incident.findMany).not.toHaveBeenCalled()
    expect(db.controle.findMany).not.toHaveBeenCalled()
  })

  it('`?vue=options` conservée : id et intitulé seulement', async () => {
    db.riskItem.findMany.mockImplementation(async () => [{ id: 'r1', intitule: 'A' }])
    const j = await (await get('?vue=options')).json()
    expect(j).toEqual({ risks: [{ id: 'r1', intitule: 'A' }], active: true })
    expect(db.riskItem.findMany.mock.calls[0][0].select).toEqual({ id: true, intitule: true })
  })
})
