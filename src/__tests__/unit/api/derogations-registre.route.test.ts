/**
 * GET /api/derogations — lot V1 (grandes listes) : sans `page`, réponse historique `{ pending }` (badge navbar) ;
 * `?page=` → registre visible (analyses accessibles + dérogations autonomes des organisations visibles), filtre,
 * recherche, tri et compteurs côté serveur.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ role: 'ANALYSTE' }))
const db = vi.hoisted(() => ({
  analyse: { findMany: vi.fn() },
  derogation: { findMany: vi.fn() },
}))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u', role: state.role } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/org-context.server', () => ({
  getAnalyseScope: vi.fn(async () => ({ role: state.role, activeOrgId: 'o', scope: { isSuperAdmin: false, visibleOrgIds: ['o'] }, memberships: [] })),
  getEffectiveRoleForOrg: vi.fn(async () => state.role),
  getAccessibleOrgIds: vi.fn(async () => ({ all: false, ids: ['o'] })),
}))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(), optionsStructure: vi.fn(async () => ({ petiteStructure: false })) }))

import { GET } from '@/app/api/derogations/route'
import { analyseWhereClause } from '@/lib/permissions'

const jours = (n: number) => new Date(Date.now() + n * 86_400_000)
const dg = (id: string, statut: string, o: { analyseId?: string | null; dateFin?: Date | null; intitule?: string } = {}) => ({
  id, analyseId: o.analyseId ?? null, portee: 'CONTROLE', referentiel: 'ISO27001', ref: 'A.5', intitule: o.intitule ?? id, statut, dateFin: o.dateFin ?? null,
})
const get = (qs = '') => GET(new NextRequest(`http://localhost/api/derogations${qs}`))

beforeEach(() => {
  vi.clearAllMocks()
  state.role = 'ANALYSTE'
  db.analyse.findMany.mockResolvedValue([{ id: 'an1', nom: 'Analyse paie' }])
  db.derogation.findMany.mockResolvedValue([
    dg('d1', 'ACTIVE', { dateFin: jours(100), analyseId: 'an1', intitule: 'Chiffrement' }),
    dg('d2', 'ACTIVE', { dateFin: jours(-3), intitule: 'MFA' }),
    dg('d3', 'DEMANDEE', { intitule: 'Sauvegardes' }),
    dg('d4', 'CLOTUREE', { intitule: 'Journalisation' }),
    dg('d5', 'ACTIVE', { dateFin: jours(10), intitule: 'Antivirus' }),
  ])
})

describe('GET /api/derogations', () => {
  it('sans `page` : réponse historique `{ pending }` (rôle sans action → 0, sans requête)', async () => {
    expect(await (await get()).json()).toEqual({ pending: 0 })
    expect(db.derogation.findMany).not.toHaveBeenCalled()
  })

  it('?page : filtre par défaut (en cours + expirées), compteurs de tous les filtres, total du registre', async () => {
    const d = await (await get('?page=1')).json()
    expect(d.rows.map((r: { id: string }) => r.id)).toEqual(['d1', 'd2', 'd5'])
    expect(d.rows[0].analyseNom).toBe('Analyse paie')
    expect(d.pagination).toEqual({ page: 1, taille: 50, total: 3, pages: 1 })
    expect(d.synthese).toEqual({ total: 5, compteurs: { EN_COURS_EXP: 3, EN_COURS: 2, EXPIREES: 1, EN_REVUE: 1, CLOTUREES: 1 } })
  })

  it('?page : même visibilité que la page (analyses accessibles OU autonomes des organisations visibles)', async () => {
    await get('?page=1')
    expect(db.analyse.findMany.mock.calls[0][0].where).toEqual(analyseWhereClause('u', 'ANALYSTE', { isSuperAdmin: false, visibleOrgIds: ['o'] }))
    expect(db.derogation.findMany.mock.calls[0][0].where).toEqual({ OR: [{ analyseId: { in: ['an1'] } }, { analyseId: null, organizationId: { in: ['o'] } }] })
  })

  it('?page : filtre, recherche et tri appliqués côté serveur ; taille de page respectée', async () => {
    expect((await (await get('?page=1&filtre=EN_REVUE')).json()).rows.map((r: { id: string }) => r.id)).toEqual(['d3'])
    expect((await (await get('?page=1&q=paie')).json()).rows.map((r: { id: string }) => r.id)).toEqual(['d1'])
    expect((await (await get('?page=1&tri=intitule&ordre=desc')).json()).rows.map((r: { intitule: string }) => r.intitule)).toEqual(['MFA', 'Chiffrement', 'Antivirus'])
    db.derogation.findMany.mockResolvedValue(Array.from({ length: 30 }, (_, i) => dg(`x${i}`, 'DEMANDEE')))
    const p = await (await get('?page=2&taille=25&filtre=EN_REVUE')).json()
    expect(p.pagination).toEqual({ page: 2, taille: 25, total: 30, pages: 2 })
    expect(p.rows).toHaveLength(5)
  })
})
