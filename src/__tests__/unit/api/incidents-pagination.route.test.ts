/**
 * GET /api/incidents — liste paginée côté serveur (lot V1) : sans `page`, réponse historique inchangée ;
 * avec `page`, requête légère sur tous les incidents (filtres, tri, tuiles, doublons) puis détail de la seule page.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

const db = vi.hoisted(() => ({
  incident: { findMany: vi.fn() },
  entite: { findMany: vi.fn(async (_args: Any) => [] as Any[]) },
}))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/org-context.server', () => ({
  getAnalyseScope: vi.fn(async () => ({ role: 'ANALYSTE', activeOrgId: 'o', scope: { isSuperAdmin: false, visibleOrgIds: ['o'] }, memberships: [] })),
  getEffectiveRoleForOrg: vi.fn(async () => 'ANALYSTE'),
}))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ incidentsActive: true, incidentsConfig: {}, champsPersonnalises: {} })) }))

import { GET } from '@/app/api/incidents/route'

const get = (qs = '') => GET(new NextRequest(`http://x/api/incidents${qs}`))
// 60 incidents : i0 et i1 quasi identiques (doublons), un tiers DECLARE, i2 rattaché à l'entité « DSI ».
const base = (i: number) => ({
  id: `i${i}`, intitule: i < 2 ? 'Panne du serveur de paie' : `Incident ${String(i).padStart(2, '0')} ${['alpha', 'beta', 'gamma'][i % 3]} ${i}`,
  statut: i % 3 === 0 ? 'DECLARE' : 'QUALIFIE', taxonomieCode: null, processusId: null, entite: i === 2 ? 'DSI' : null, entiteId: null,
  dateSurvenance: new Date('2026-10-01'), dateDetection: null, montantBrut: i === 4 ? 1000 : null, recuperations: i === 4 ? 200 : null, riskItemId: i === 7 ? 'r1' : null,
  processus: null, riskItem: i === 7 ? { intitule: 'Fraude' } : null, risquesLies: [] as { riskItem: { id: string; intitule: string } }[],
})
const TOUS = Array.from({ length: 60 }, (_, i) => base(i))
const detail = (id: string) => ({
  ...TOUS.find(x => x.id === id)!, description: null, organizationId: 'o', champs: {}, doraCriteres: null, doraClasseMajeurLe: null,
  doraInitialeSoumiseLe: null, doraIntermediaireSoumiseLe: null, doraFinaleSoumiseLe: null, attributs: {}, notifications: [], pertes: [], createdAt: new Date('2026-10-02'),
})

beforeEach(() => {
  vi.clearAllMocks()
  db.incident.findMany.mockImplementation(async (args: { where: { id?: { in: string[] } }; select?: unknown }) => {
    if (args.where.id) return [...args.where.id.in].reverse().map(detail)
    if (args.select) return TOUS
    return TOUS.map(x => detail(x.id))
  })
})

describe('GET /api/incidents — pagination serveur', () => {
  it('sans `page` : forme historique (tous les incidents, config, sans pagination ni synthèse)', async () => {
    const j = await (await get()).json()
    expect(Object.keys(j).sort()).toEqual(['active', 'config', 'incidents'])
    expect(j.incidents).toHaveLength(60)
    expect(j.incidents[0].doublons.map((d: { id: string }) => d.id)).toEqual(['i1'])
  })

  it('avec `page` : taille, total, tuiles sur tous les incidents, ordre et doublons de la page', async () => {
    const j = await (await get('?page=1&taille=25')).json()
    expect(j.pagination).toEqual({ page: 1, taille: 25, total: 60, pages: 3 })
    expect(j.incidents.map((i: { id: string }) => i.id).slice(0, 3)).toEqual(['i0', 'i1', 'i2'])
    expect(j.synthese).toMatchObject({ total: 60, aQualifier: 20, perteNetteTotale: 800, entiteFrequente: 'DSI' })
    expect(j.incidents[0].doublons.map((d: { id: string }) => d.id)).toEqual(['i1'])
    expect(j.config).toBeTruthy()
    const detailCall = db.incident.findMany.mock.calls.find(c => c[0].where.id)![0]
    expect(detailCall.where).toMatchObject({ organizationId: 'o' })
    expect(detailCall.where.id.in).toHaveLength(25)
  })

  it('filtres côté serveur : statut (deep-link, sans casse), colonne risques, recherche, tri par perte', async () => {
    expect((await (await get('?page=1&statut=declare')).json()).pagination.total).toBe(20)
    const parRisque = await (await get(`?page=1&col_risque=${encodeURIComponent(JSON.stringify(['Fraude']))}`)).json()
    expect(parRisque.incidents.map((i: { id: string }) => i.id)).toEqual(['i7'])
    expect((await (await get('?page=1&q=gamma')).json()).pagination.total).toBe(20)
    const tri = await (await get('?page=1&tri=perte&ordre=desc')).json()
    expect(tri.incidents[0]).toMatchObject({ id: 'i4', perteNette: 800 })
  })

  it('filtre par entité : référentiel lu seulement quand il est demandé (alias et sous-entités)', async () => {
    await get('?page=1')
    expect(db.entite.findMany).not.toHaveBeenCalled()
    db.entite.findMany.mockResolvedValue([
      { id: 'dsi', nom: 'Direction des SI', type: 'DIRECTION', alias: ['DSI'], codeExterne: null, parentId: null, source: 'MANUEL', valideAu: null },
    ] as never)
    const j = await (await get('?page=1&entite=dsi')).json()
    expect(j.incidents.map((i: { id: string }) => i.id)).toEqual(['i2'])
    expect(db.entite.findMany.mock.calls[0][0].where).toEqual({ organizationId: 'o' })
  })

  it('`?vue=options` : liste légère pour la détection de doublons à la déclaration', async () => {
    db.incident.findMany.mockImplementation(async () => [{ id: 'i1', intitule: 'A', statut: 'DECLARE' }])
    const j = await (await get('?vue=options')).json()
    expect(j).toEqual({ incidents: [{ id: 'i1', intitule: 'A', statut: 'DECLARE' }], active: true })
    expect(db.incident.findMany.mock.calls[0][0].select).toMatchObject({ id: true, intitule: true, statut: true })
  })
})
