/** Plan d'audit — pagination côté serveur (lot V1) : forme historique sans `page` ; page, filtres, synthèse et visibilité avec `page`. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Args = { where: Record<string, unknown>; select?: Record<string, unknown>; include?: Record<string, unknown> }
const state = vi.hoisted(() => ({ role: 'AUDITEUR' }))
const db = vi.hoisted(() => ({
  auditMission: { findMany: vi.fn(async (_a: Args) => [] as unknown[]) },
  user: { findUnique: vi.fn(async () => ({ name: 'Marie Dupont', email: 'marie@ex.fr' })) },
}))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u', role: state.role } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: vi.fn(async () => ({ role: state.role, activeOrgId: 'o' })) }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ auditInterneActive: true, champsPersonnalises: {}, archivageMissionsAnnees: 5 })) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: () => '' }))

import { GET } from '@/app/api/audit/missions/route'

// 60 missions : m0..m59 ; m3 archivée ; m1x EN_COURS ; constat critique ouvert sur les missions paires.
const mission = (i: number) => ({
  id: `m${i}`, organizationId: 'o', intitule: i === 42 ? 'Revue des accès' : `Mission ${i}`, responsable: 'Chef audit',
  statut: i >= 10 && i < 20 ? 'EN_COURS' : 'PLANIFIEE', type: 'THEMATIQUE', dateDebut: null, dateFin: null,
  archiveLe: i === 3 ? new Date('2026-01-01') : null, champs: {}, rapports: [{ id: 'r' }],
  constats: i % 2 === 0 ? [{ criticite: 4, statut: 'OUVERT', echeance: null, responsableAction: i === 42 ? 'Marie Dupont' : 'Paul' }] : [],
})
const appel = (qs = '') => GET(new NextRequest(`http://x/api/audit/missions${qs}`))

beforeEach(() => {
  vi.clearAllMocks()
  state.role = 'AUDITEUR'
  db.auditMission.findMany.mockImplementation(async (a: Args) => {
    const ids = (a.where.id as { in?: string[] } | undefined)?.in
    const toutes = Array.from({ length: 60 }, (_, i) => mission(i))
    return ids ? toutes.filter(m => ids.includes(m.id)).reverse() : toutes
  })
})

describe('GET /api/audit/missions paginé', () => {
  it('sans `page` : réponse historique (toutes les missions, ni pagination ni synthèse)', async () => {
    const d = await (await appel()).json()
    expect(d.missions).toHaveLength(60)
    expect(d).not.toHaveProperty('pagination')
    expect(d).not.toHaveProperty('synthese')
    expect(db.auditMission.findMany).toHaveBeenCalledTimes(1)
  })

  it('avec `page` : archives masquées, taille respectée, détail de la seule page, synthèse sur tout le plan', async () => {
    const d = await (await appel('?page=1&taille=25')).json()
    expect(d.pagination).toEqual({ page: 1, taille: 25, total: 59, pages: 3 })
    expect(d.synthese).toEqual({ total: 60, enCours: 10, critiques: 30, enRetard: 0, archivees: 1 })
    expect(d.missions).toHaveLength(25)
    expect(d.missions.map((m: { id: string }) => m.id)).not.toContain('m3')
    expect(d.missions[0]).toMatchObject({ id: 'm0', constatsOuverts: 1, nbRapports: 1 })
    expect(d.missions.map((m: { id: string }) => m.id).slice(0, 4)).toEqual(['m0', 'm1', 'm2', 'm4'])
    const [leger, detail] = db.auditMission.findMany.mock.calls.map(c => c[0])
    expect(leger.select).toBeDefined()
    expect(leger.select).not.toHaveProperty('programme')
    expect((detail.where.id as { in: string[] }).in).toHaveLength(25)
    expect(detail.where).toMatchObject({ organizationId: 'o' })
  })

  it('filtres côté serveur : statut, recherche, archives', async () => {
    const enCours = await (await appel('?page=1&statut=EN_COURS')).json()
    expect(enCours.pagination.total).toBe(10)
    const q = await (await appel('?page=1&q=acces')).json()
    expect(q.missions.map((m: { id: string }) => m.id)).toEqual(['m42'])
    const arch = await (await appel('?page=1&archives=1&taille=100')).json()
    expect(arch.pagination.total).toBe(60)
  })

  it('visibilité inchangée : la 1re ligne ne voit que les missions portant ses constats', async () => {
    state.role = 'METIER'
    const d = await (await appel('?page=1')).json()
    expect(d.synthese.total).toBe(1)
    expect(d.missions.map((m: { id: string }) => m.id)).toEqual(['m42'])
    expect(d.missions[0].nbRapports).toBe(0)
  })
})
