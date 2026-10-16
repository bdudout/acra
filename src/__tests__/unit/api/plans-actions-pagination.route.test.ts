// Lot V1 : GET /api/organizations/[orgId]/plans-actions — réponse historique sans `page`, liste paginée sinon.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const findMany = vi.hoisted(() => vi.fn())
vi.mock('@/lib/prisma', () => ({ prisma: { planAction: { findMany } } }))
vi.mock('@/lib/route-guard.server', () => ({ requireSession: vi.fn(async () => ({ error: null, user: { id: 'u', role: 'RSSI' } })) }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: vi.fn(async () => ({ scope: { visibleOrgIds: ['o1'], isSuperAdmin: false }, role: 'RSSI', activeOrgId: 'o1' })) }))
vi.mock('@/lib/with-access.server', () => ({ withAccess: (_o: unknown, h: unknown) => h }))
vi.mock('@/lib/entites.server', () => ({ entiteIdPourTexte: vi.fn() }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn() }))

import { GET } from '@/app/api/organizations/[orgId]/plans-actions/route'

const ctx = { params: Promise.resolve({ orgId: 'o1' }) }
const appel = (q: string) => GET(new Request(`http://localhost/api/organizations/o1/plans-actions${q}`) as never, ctx)
const leger = (id: string, o: Record<string, unknown> = {}) => ({ id, titre: `Plan ${id}`, porteur: null, entite: null, statut: 'A_FAIRE', priorite: 'MAJEUR', echeance: null, createdAt: new Date('2026-01-01'), ...o })

beforeEach(() => { findMany.mockReset() })

describe('GET plans-actions (lot V1)', () => {
  it('sans `page` : forme historique { plans } complète, filtres type/targetId/statut conservés', async () => {
    findMany.mockResolvedValue([{ id: 'p1', liens: [] }])
    const res = await appel('?type=CONFORMITE&targetId=ISO27001&statut=FAIT')
    const j = await res.json()
    expect(Object.keys(j)).toEqual(['plans'])
    expect(findMany).toHaveBeenCalledTimes(1)
    const arg = findMany.mock.calls[0][0]
    expect(arg.where).toEqual({ organizationId: 'o1', statut: 'FAIT', liens: { some: { type: 'CONFORMITE', targetId: 'ISO27001' } } })
    expect(arg.include.liens).toBeTruthy()
  })

  it('avec `page` : requête légère, filtre de recherche, page demandée, synthèse sur tout le résultat, détail de la page seule', async () => {
    const legers = [
      leger('a', { titre: 'Chiffrer les sauvegardes', statut: 'FAIT' }),
      ...Array.from({ length: 30 }, (_, i) => leger(`s${i}`, { titre: `Sauvegarde ${i}`, echeance: new Date('2020-01-01') })),
      leger('z', { titre: 'Autre chose' }),
    ]
    findMany.mockImplementation(async (arg: { select?: unknown; where: { id?: { in: string[] } } }) =>
      arg.select ? legers : [...arg.where.id!.in].reverse().map(id => ({ id, liens: [] })))
    const res = await appel('?type=RISQUE&page=2&taille=25&q=sauvegarde')
    const j = await res.json()
    expect(findMany).toHaveBeenCalledTimes(2)
    expect(findMany.mock.calls[0][0].select).toBeTruthy()
    expect(findMany.mock.calls[0][0].where.liens).toEqual({ some: { type: 'RISQUE' } })
    expect(j.pagination).toEqual({ page: 2, taille: 25, total: 31, pages: 2 })
    // Page 2 = 6 dernières lignes filtrées, dans l'ordre du tri (restauré malgré l'ordre de la base).
    expect(findMany.mock.calls[1][0].where.id.in).toHaveLength(6)
    expect(j.plans.map((p: { id: string }) => p.id)).toEqual(['s24', 's25', 's26', 's27', 's28', 's29'])
    expect(j.synthese).toMatchObject({ total: 31, faits: 1, enRetard: 30 })
  })

  it('tri serveur par priorité (rang métier)', async () => {
    findMany.mockImplementation(async (arg: { select?: unknown; where: { id?: { in: string[] } } }) =>
      arg.select ? [leger('m', { priorite: 'MODERE' }), leger('c', { priorite: 'CRITIQUE' }), leger('j')] : arg.where.id!.in.map(id => ({ id, liens: [] })))
    const j = await (await appel('?page=1&tri=priorite&ordre=asc')).json()
    expect(j.plans.map((p: { id: string }) => p.id)).toEqual(['c', 'j', 'm'])
  })
})
