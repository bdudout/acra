/**
 * GET /api/analyses — lot V1 (grandes listes) : sans `page`, réponse historique inchangée ; `?vue=options` pour les
 * menus ; `?page=` → requête légère sur tout le périmètre, filtres/tri/compteurs côté serveur, détail de la seule page.
 * La clause de visibilité (analyseWhereClause) est appliquée à chaque requête.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  analyse: { findMany: vi.fn() },
  risque: { groupBy: vi.fn() },
  mesure: { groupBy: vi.fn(async () => []) },
}))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/org-context.server', () => ({
  getAnalyseScope: vi.fn(async () => ({ role: 'ANALYSTE', activeOrgId: 'o', scope: { isSuperAdmin: false, visibleOrgIds: ['o'] }, memberships: [] })),
  getEffectiveRoleForOrg: vi.fn(async () => 'ANALYSTE'),
  getAccessibleOrgIds: vi.fn(async () => ({ all: false, ids: ['o'] })),
}))

import { GET } from '@/app/api/analyses/route'
import { analyseWhereClause } from '@/lib/permissions'

const WHERE = analyseWhereClause('u', 'ANALYSTE', { isSuperAdmin: false, visibleOrgIds: ['o'] })
const a = (id: string, nom: string, o: { statut?: string; tags?: string[]; risques?: number; updatedAt?: string; organisation?: string } = {}) => ({
  id, nom, organisation: o.organisation ?? 'Org', statut: o.statut ?? 'EN_COURS', tags: o.tags ?? [], atelierCourant: 1,
  updatedAt: new Date(o.updatedAt ?? '2026-10-01'), _count: { risques: o.risques ?? 0 },
})
const LEGERES = [
  a('a1', 'Paie', { tags: ['RH'], risques: 2 }),
  a('a2', 'Portail', { statut: 'TERMINE', risques: 5 }),
  a('a3', 'Écoles', { tags: ['rh', 'Public'], risques: 1 }),
  a('a4', 'Achats', { risques: 0 }),
]
const MAX: Record<string, number> = { a1: 12, a2: 4, a3: 16 }
const get = (qs = '') => GET(new NextRequest(`http://localhost/api/analyses${qs}`))

beforeEach(() => {
  vi.clearAllMocks()
  db.analyse.findMany.mockImplementation(async (args: { select: Record<string, unknown>; where: { AND?: [unknown, { id: { in: string[] } }] } }) => {
    // Détail d'une page : lignes demandées (ordre volontairement différent, l'ordre de la page doit être rétabli).
    if (args.where.AND) return [...args.where.AND[1].id.in].reverse().map(id => ({ ...LEGERES.find(x => x.id === id)!, description: 'détail', secteur: null }))
    return LEGERES
  })
  db.risque.groupBy.mockImplementation(async (args: { _max?: unknown; where: { analyseId?: { in: string[] } } }) =>
    args._max ? Object.entries(MAX).filter(([id]) => !args.where.analyseId || args.where.analyseId.in.includes(id)).map(([analyseId, n]) => ({ analyseId, _max: { niveauRisque: n } })) : [])
})

describe('GET /api/analyses', () => {
  it('sans `page` : forme historique (toutes les analyses + riskSummary, sans pagination)', async () => {
    const d = await (await get()).json()
    expect(d.analyses).toHaveLength(4)
    expect(d.analyses[0].riskSummary).toEqual({ maxRisk: 12, critiques: 0, reduire: 0, p1AFaire: 0 })
    expect(d.pagination).toBeUndefined()
    expect(d.synthese).toBeUndefined()
    expect(db.analyse.findMany.mock.calls[0][0].where).toEqual(WHERE)
  })

  it('?vue=options : identifiant, nom, statut, organisation — même clause de visibilité', async () => {
    db.analyse.findMany.mockResolvedValueOnce([{ id: 'a1', nom: 'Paie', statut: 'EN_COURS', organisation: 'Org' }])
    const d = await (await get('?vue=options')).json()
    expect(d).toEqual({ analyses: [{ id: 'a1', nom: 'Paie', statut: 'EN_COURS', organisation: 'Org' }] })
    const args = db.analyse.findMany.mock.calls[0][0]
    expect(args.where).toEqual(WHERE)
    expect(Object.keys(args.select)).toEqual(['id', 'nom', 'statut', 'organisation'])
  })

  it('?page : tri par risque, taille respectée, compteurs sur tout le périmètre, détail de la seule page', async () => {
    const d = await (await get('?page=1&taille=25')).json()
    expect(d.pagination).toEqual({ page: 1, taille: 25, total: 4, pages: 1 })
    expect(d.synthese).toEqual({ total: 4, tags: ['Public', 'RH'] })
    // Tri par défaut de l'écran : risque max desc puis nombre de risques.
    expect(d.analyses.map((x: { id: string }) => x.id)).toEqual(['a3', 'a1', 'a2', 'a4'])
    expect(d.analyses[0].riskSummary.maxRisk).toBe(16)
    expect(d.analyses[0].description).toBe('détail')
    // 1re requête légère (sans colonnes de détail), 2e requête de détail bornée aux ids de la page ET à la clause.
    const [leger, detail] = db.analyse.findMany.mock.calls.map(c => c[0])
    expect(leger.where).toEqual(WHERE)
    expect(leger.select.description).toBeUndefined()
    expect(detail.where.AND[0]).toEqual(WHERE)
    // Risque max de tout le périmètre : agrégé en base, sous la même clause.
    expect(db.risque.groupBy.mock.calls[0][0].where).toEqual({ analyse: WHERE })
  })

  it('?page : filtre de statut, tag et recherche appliqués côté serveur ; compteurs inchangés', async () => {
    const d = await (await get('?page=1&tag=rh&q=ecoles')).json()
    expect(d.analyses.map((x: { id: string }) => x.id)).toEqual(['a3'])
    expect(d.pagination.total).toBe(1)
    expect(d.synthese.total).toBe(4)
    const t = await (await get('?page=1&filter=termine')).json()
    expect(t.analyses.map((x: { id: string }) => x.id)).toEqual(['a2'])
  })

  it('?page : pagination et tri par colonne ; seules les lignes de la page sont chargées en détail', async () => {
    const d = await (await get('?page=2&taille=25&tri=nom&ordre=asc')).json()
    expect(d.pagination.page).toBe(1) // page ramenée dans les bornes
    expect(d.analyses.map((x: { nom: string }) => x.nom)).toEqual(['Achats', 'Écoles', 'Paie', 'Portail'])
    const LOT = Array.from({ length: 60 }, (_, i) => a(`x${i}`, `Analyse ${String(i).padStart(2, '0')}`))
    db.analyse.findMany.mockImplementation(async (args: { where: { AND?: [unknown, { id: { in: string[] } }] } }) =>
      args.where.AND ? LOT.filter(x => args.where.AND![1].id.in.includes(x.id)) : LOT)
    const p2 = await (await get('?page=2&taille=50&tri=nom')).json()
    expect(p2.pagination).toEqual({ page: 2, taille: 50, total: 60, pages: 2 })
    expect(p2.analyses).toHaveLength(10)
    expect(db.analyse.findMany.mock.calls.at(-1)![0].where.AND[1].id.in).toHaveLength(10)
  })
})
