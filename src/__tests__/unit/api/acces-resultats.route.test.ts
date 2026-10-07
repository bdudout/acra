/**
 * Résultats d'audit et de contrôle réservés aux interlocuteurs concernés : lecture globale du dispositif = tout ;
 * 1re ligne et lecture seule = seulement ce dont l'utilisateur est responsable (nom ou e-mail).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ role: 'ANALYSTE' }))
const db = vi.hoisted(() => ({
  controle: { findMany: vi.fn() },
  arrangementTic: { findMany: vi.fn(async () => []) },
  analyse: { findMany: vi.fn(async () => []) },
  auditMission: { findMany: vi.fn() },
  user: { findUnique: vi.fn(async () => ({ name: 'Marie Dupont', email: 'marie@ex.fr' })) },
  organization: { findUnique: vi.fn(async () => ({ path: '/o/', nom: 'Org' })) },
}))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u', role: state.role } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/org-context.server', () => ({
  getAnalyseScope: vi.fn(async () => ({ role: state.role, activeOrgId: 'o', scope: { isSuperAdmin: false, visibleOrgIds: ['o'] }, memberships: [] })),
  getEffectiveRoleForOrg: vi.fn(async () => state.role),
  getAccessibleOrgIds: vi.fn(async () => ({ all: false, ids: ['o'] })),
}))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ controlePermanentActive: true, auditInterneActive: true, secondeLigneActive: true, champsPersonnalises: {}, archivageMissionsAnnees: 5 })) }))

import { GET as getControles } from '@/app/api/controles/route'
import { GET as getMissions } from '@/app/api/audit/missions/route'
import { GET as getReseau } from '@/app/api/controles/reseau/route'

const ctrl = (id: string, responsable: string | null) => ({ id, organizationId: 'o', intitule: id, responsable, periodicite: 'MENSUEL', actif: true, createdAt: new Date('2026-01-01'), champs: {}, cle: false, modeControle: 'MANUEL', conception: null, processus: null, riskItem: null, executions: [], arrangementTicId: null, projetId: null })
const mission = (id: string, responsable: string | null, constats: { responsableAction: string | null }[]) => ({ id, organizationId: 'o', intitule: id, responsable, statut: 'EN_COURS', dateFin: null, archiveLe: null, champs: {}, rapports: [{ id: 'r' }], constats: constats.map(c => ({ criticite: 'MAJEURE', statut: 'OUVERT', echeance: null, ...c })) })

beforeEach(() => {
  vi.clearAllMocks()
  db.controle.findMany.mockResolvedValue([ctrl('a', 'Marie Dupont'), ctrl('b', 'Contrôle permanent'), ctrl('c', 'marie@ex.fr; Paul')])
  db.auditMission.findMany.mockResolvedValue([mission('m1', 'Chef audit', [{ responsableAction: 'Marie Dupont' }, { responsableAction: 'Paul' }]), mission('m2', 'Chef audit', [{ responsableAction: 'Paul' }])])
})

describe('contrôles', () => {
  it('analyste : seulement les contrôles dont il est responsable', async () => {
    const d = await (await getControles()).json()
    expect(d.controles.map((c: { id: string }) => c.id)).toEqual(['a', 'c'])
  })
  it('contrôleur (lecture globale) : tous les contrôles', async () => {
    state.role = 'CONTROLEUR'
    const d = await (await getControles()).json()
    expect(d.controles).toHaveLength(3)
    state.role = 'ANALYSTE'
  })
  it('vue réseau (consolidation des résultats) refusée à la 1re ligne', async () => {
    state.role = 'METIER'
    expect(await (await getReseau({} as never)).json()).toEqual({ active: false })
    state.role = 'ANALYSTE'
  })
})

describe('missions d’audit', () => {
  it('métier : missions portant au moins un de ses constats, synthèse sur ces seuls constats, sans rapports', async () => {
    state.role = 'METIER'
    const d = await (await getMissions()).json()
    expect(d.missions.map((m: { id: string }) => m.id)).toEqual(['m1'])
    expect(d.missions[0].constatsOuverts).toBe(1)
    expect(d.missions[0].nbRapports).toBe(0)
    state.role = 'ANALYSTE'
  })
  it('auditeur : toutes les missions', async () => {
    state.role = 'AUDITEUR'
    const d = await (await getMissions()).json()
    expect(d.missions).toHaveLength(2)
    state.role = 'ANALYSTE'
  })
})
