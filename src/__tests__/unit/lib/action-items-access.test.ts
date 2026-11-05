import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  analyseFindMany: vi.fn(), mesureFindMany: vi.fn(), planFindMany: vi.fn(),
  traitementFindMany: vi.fn(), constatFindMany: vi.fn(), executionFindMany: vi.fn(), incidentFindMany: vi.fn(),
  userFindUnique: vi.fn(), riskItemFindMany: vi.fn(), rattachementFindMany: vi.fn(), axeFindMany: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  analyse: { findMany: m.analyseFindMany }, mesure: { findMany: m.mesureFindMany },
  planAction: { findMany: m.planFindMany }, conformiteTraitement: { findMany: m.traitementFindMany },
  auditConstat: { findMany: m.constatFindMany }, controleExecution: { findMany: m.executionFindMany },
  incident: { findMany: m.incidentFindMany }, user: { findUnique: m.userFindUnique },
  riskItem: { findMany: m.riskItemFindMany }, rattachementStrategique: { findMany: m.rattachementFindMany }, axeStrategique: { findMany: m.axeFindMany },
} }))

import { gatherActionItems, axesStrategiquesActifs } from '@/lib/action-items.server'

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

describe('gatherActionItems — catégorie et axes stratégiques (lot S2)', () => {
  const mods = { ...modules, incidentsActive: true, auditInterneActive: true }
  beforeEach(() => {
    m.incidentFindMany.mockResolvedValue([
      { id: 'i1', intitule: 'Rançongiciel', description: null, statut: 'OUVERT', impactEstime: 3, entite: null, entiteId: null, riskItemId: 'ri1' },
      { id: 'i2', intitule: 'Panne', description: null, statut: 'OUVERT', impactEstime: 2, entite: null, entiteId: null, riskItemId: 'ri1' },
      { id: 'i3', intitule: 'Sans risque', description: null, statut: 'OUVERT', impactEstime: 2, entite: null, entiteId: null, riskItemId: null },
    ])
    m.constatFindMany.mockResolvedValue([])
    m.riskItemFindMany.mockResolvedValue([{ id: 'ri1', familleRisqueTic: 'CYBER' }])
    m.rattachementFindMany.mockResolvedValue([
      { sourceType: 'INCIDENT', sourceId: 'i1', axe: { id: 'ax1', titre: 'Protéger', strategie: { id: 's1', titre: 'Cyber 2027' } } },
    ])
  })

  it('familles des risques liés en UNE requête (ids dédoublonnés, dans l’org), catégorie déduite', async () => {
    const items = await gatherActionItems('org', mods, { ...access, role: 'RSSI' })
    expect(m.riskItemFindMany).toHaveBeenCalledTimes(1)
    expect(m.riskItemFindMany.mock.calls[0][0].where).toMatchObject({ organizationId: 'org', id: { in: ['ri1'] } })
    const cat = Object.fromEntries(items.map(i => [i.id, i.categorie]))
    expect(cat).toMatchObject({ 'INCIDENT:i1': 'CYBER', 'INCIDENT:i2': 'CYBER', 'INCIDENT:i3': 'INCIDENT' })
  })

  it('aucun risque lié : pas de requête sur le registre', async () => {
    m.incidentFindMany.mockResolvedValue([])
    await gatherActionItems('org', mods, { ...access, role: 'RSSI' })
    expect(m.riskItemFindMany).not.toHaveBeenCalled()
  })

  it('module Stratégie actif : axes des stratégies NON archivées de l’org, en une requête', async () => {
    const items = await gatherActionItems('org', { ...mods, strategieActive: true }, { ...access, role: 'RSSI' })
    expect(m.rattachementFindMany).toHaveBeenCalledTimes(1)
    const where = m.rattachementFindMany.mock.calls[0][0].where
    expect(where).toMatchObject({ organizationId: 'org', axe: { strategie: { organizationId: 'org', statut: { not: 'ARCHIVEE' } } } })
    expect([...where.sourceId.in].sort()).toEqual(['i1', 'i2', 'i3']) // bornée aux actions retenues
    expect(items.find(i => i.id === 'INCIDENT:i1')?.axes).toEqual([{ strategieId: 's1', strategieTitre: 'Cyber 2027', axeId: 'ax1', axeTitre: 'Protéger' }])
    expect(items.find(i => i.id === 'INCIDENT:i2')?.axes).toEqual([])
  })

  it('module Stratégie inactif (ou non précisé) : aucun rattachement chargé', async () => {
    const items = await gatherActionItems('org', mods, { ...access, role: 'RSSI' })
    expect(m.rattachementFindMany).not.toHaveBeenCalled()
    expect(items.every(i => Array.isArray(i.axes) && i.axes.length === 0)).toBe(true)
  })
})

describe('lot S2 — garde de lecture des stratégies (peutVoirStrategie)', () => {
  const mods = { ...modules, incidentsActive: true, strategieActive: true }
  beforeEach(() => {
    m.incidentFindMany.mockResolvedValue([{ id: 'i1', intitule: 'X', description: null, statut: 'OUVERT', impactEstime: 2, entite: null, entiteId: null, riskItemId: null }])
    m.rattachementFindMany.mockResolvedValue([{ sourceType: 'INCIDENT', sourceId: 'i1', axe: { id: 'ax1', titre: 'Protéger', strategie: { id: 's1', titre: 'Secret' } } }])
    m.axeFindMany.mockResolvedValue([{ id: 'ax1', titre: 'Protéger', strategie: { id: 's1', titre: 'Secret', statut: 'BROUILLON' } }])
  })
  for (const role of ['LECTEUR', 'ANALYSTE', 'METIER'] as const) {
    it(`${role} : aucun rattachement chargé, axes vides, aucun titre de stratégie`, async () => {
      const items = await gatherActionItems('org', mods, { ...access, role })
      expect(m.rattachementFindMany).not.toHaveBeenCalled()
      expect(items.every(i => i.axes?.length === 0)).toBe(true)
      expect(JSON.stringify(items)).not.toContain('Secret')
      expect(await axesStrategiquesActifs('org', role)).toEqual([])
      expect(m.axeFindMany).not.toHaveBeenCalled()
    })
  }
  it('RSSI : axes des stratégies actives, requête bornée (take)', async () => {
    const axes = await axesStrategiquesActifs('org', 'RSSI')
    expect(axes).toEqual([{ strategieId: 's1', strategieTitre: 'Secret', strategieStatut: 'BROUILLON', axeId: 'ax1', axeTitre: 'Protéger' }])
    expect(m.axeFindMany.mock.calls[0][0].take).toBe(200)
  })
})
