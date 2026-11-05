import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  analyseFindMany: vi.fn(), mesureFindMany: vi.fn(), planFindMany: vi.fn(),
  traitementFindMany: vi.fn(), constatFindMany: vi.fn(), executionFindMany: vi.fn(), incidentFindMany: vi.fn(),
  userFindUnique: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  analyse: { findMany: m.analyseFindMany }, mesure: { findMany: m.mesureFindMany },
  planAction: { findMany: m.planFindMany }, conformiteTraitement: { findMany: m.traitementFindMany },
  auditConstat: { findMany: m.constatFindMany }, controleExecution: { findMany: m.executionFindMany },
  incident: { findMany: m.incidentFindMany }, user: { findUnique: m.userFindUnique },
} }))

import { gatherActionItems } from '@/lib/action-items.server'

const modules = { incidentsActive: false, controlePermanentActive: false, auditInterneActive: false, registreRisquesActive: false, conformiteActive: false }
const access = { userId: 'analyst', role: 'ANALYSTE' as const, scope: { visibleOrgIds: ['org'], isSuperAdmin: false } }

beforeEach(() => {
  vi.clearAllMocks()
  m.analyseFindMany.mockResolvedValue([])
  m.mesureFindMany.mockResolvedValue([])
  m.planFindMany.mockResolvedValue([])
})

describe('gatherActionItems — WSTG-ATHZ-02/04', () => {
  it('limite les mesures et actions de risque aux analyses accessibles et actives', async () => {
    m.analyseFindMany.mockImplementation(async (query: { where: { id?: unknown } }) =>
      query.where.id ? [] : [{ id: 'shared' }],
    )
    await gatherActionItems('org', modules, access)

    const accessible = m.analyseFindMany.mock.calls[0][0].where
    expect(accessible).toMatchObject({ organizationId: 'org', deletedAt: null, OR: [
      { userId: 'analyst' }, { accesUtilisateurs: { some: { userId: 'analyst' } } },
    ] })
    expect(m.mesureFindMany.mock.calls[0][0].where).toMatchObject({ analyseId: { in: ['shared'] } })
    expect(m.analyseFindMany.mock.calls[1][0].where).toMatchObject({ id: { in: ['shared'] } })
    const linkedPlans = m.planFindMany.mock.calls.find(([query]) => query.where.liens?.some?.type === 'RISQUE_ANALYSE')?.[0]
    expect(linkedPlans?.where.liens.some.ref).toEqual({ in: ['shared'] })
  })

  it('ne charge aucun contenu d’analyse si le lecteur ne voit aucune analyse', async () => {
    await gatherActionItems('org', modules, { ...access, role: 'LECTEUR' })
    expect(m.mesureFindMany.mock.calls[0][0].where.analyseId).toEqual({ in: [] })
    expect(m.analyseFindMany.mock.calls[1][0].where.id).toEqual({ in: [] })
  })
})

describe('gatherActionItems — 1re ligne : constats d’audit et anomalies de contrôle (acces-resultats)', () => {
  const mods = { ...modules, auditInterneActive: true, controlePermanentActive: true }
  beforeEach(() => {
    m.userFindUnique.mockResolvedValue({ name: 'Alice Martin', email: 'alice@ex.fr' })
    m.constatFindMany.mockResolvedValue([
      { id: 'k1', intitule: 'Autre mission', recommandation: 'secret audit', statut: 'OUVERT', responsableAction: 'Bob', missionId: 'm1', mission: { responsable: 'Bob' } },
      { id: 'k2', intitule: 'Mon action', recommandation: 'à moi', statut: 'OUVERT', responsableAction: 'Alice Martin', missionId: 'm1', mission: { responsable: 'Bob' } },
      { id: 'k3', intitule: 'Ma mission', recommandation: 'ma mission', statut: 'OUVERT', responsableAction: 'Carol', missionId: 'm2', mission: { responsable: 'alice@ex.fr' } },
    ])
    m.executionFindMany.mockResolvedValue([
      { id: 'e1', constat: 'anomalie de Bob', dateRealisation: null, controleId: 'c1', controle: { intitule: 'Sauvegardes', responsable: 'Bob' } },
      { id: 'e2', constat: 'anomalie d’Alice', dateRealisation: null, controleId: 'c2', controle: { intitule: 'Comptes', responsable: 'Alice Martin; Dan' } },
    ])
  })
  it('ANALYSTE : seuls ses constats (mission dont il est responsable ou action qui lui revient) et les anomalies de ses contrôles', async () => {
    const items = await gatherActionItems('org', mods, access)
    expect(items.map(i => i.id).sort()).toEqual(['AUDIT:k2', 'AUDIT:k3', 'CONTROLE:e2'])
    expect(JSON.stringify(items)).not.toContain('secret audit')
    expect(JSON.stringify(items)).not.toContain('anomalie de Bob')
    expect(m.constatFindMany.mock.calls[0][0].select.mission).toEqual({ select: { responsable: true } })
  })
  it('rôle à lecture globale (RSSI) : comportement inchangé, tout est rendu', async () => {
    const items = await gatherActionItems('org', mods, { ...access, role: 'RSSI' })
    expect(items.map(i => i.id).sort()).toEqual(['AUDIT:k1', 'AUDIT:k2', 'AUDIT:k3', 'CONTROLE:e1', 'CONTROLE:e2'])
    expect(m.userFindUnique).not.toHaveBeenCalled()
  })
})

describe('gatherActionItems — facette conformité : même droit de lecture que /conformite', () => {
  const mods = { ...modules, conformiteActive: true }
  beforeEach(() => {
    m.traitementFindMany.mockResolvedValue([
      { id: 't1', intitule: 'Chiffrer les sauvegardes', description: null, responsable: null, echeance: null, statut: 'A_FAIRE', referentiel: 'ISO27001', refs: [] },
    ])
  })

  it('LECTEUR : aucune action de conformité (la page /conformite lui est fermée)', async () => {
    const items = await gatherActionItems('org', mods, { ...access, role: 'LECTEUR' })
    expect(m.traitementFindMany).not.toHaveBeenCalled()
    expect(items.filter(i => i.source === 'CONFORMITE')).toHaveLength(0)
  })

  it('ANALYSTE : les actions de conformité restent visibles', async () => {
    await gatherActionItems('org', mods, access)
    expect(m.traitementFindMany).toHaveBeenCalled()
  })
})
