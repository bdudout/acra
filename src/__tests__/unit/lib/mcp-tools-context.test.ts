// Outils MCP de contexte (phase 2) : read_taxonomie (statique), read_sector_examples
// (catalogue livré), read_risk_posture (agrégat org-scopé). On mocke prisma pour la
// posture ; taxonomie/exemples utilisent les données livrées réelles.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const groupBy = vi.fn()
const findMany = vi.fn()
const count = vi.fn()
const planGroupBy = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    analyse: { groupBy: (...a: unknown[]) => groupBy(...a), count: (...a: unknown[]) => count(...a) },
    risque: { findMany: (...a: unknown[]) => findMany(...a) },
    planAction: { groupBy: (...a: unknown[]) => planGroupBy(...a) },
  },
}))

import { readTaxonomieTool, readSectorExamplesTool, readRiskPostureTool } from '@/lib/mcp/tools-context.server'

const ctx = { organizationId: 'orgA', keyId: 'k1' }
const parse = (r: { content: { text: string }[] }) => JSON.parse(r.content[0].text)

describe('read_taxonomie', () => {
  it('renvoie le vocabulaire méthode SANS habillage UI (couleurs/emojis)', async () => {
    const out = parse(await readTaxonomieTool.handler({}, ctx))
    expect(out.criteresSecurite).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'D', label: 'Disponibilité' }),
    ]))
    expect(out.niveauxGravite).toHaveLength(4)
    expect(out.strategiesTraitement.map((s: { value: string }) => s.value)).toContain('REDUIRE')
    expect(out.ateliers).toHaveLength(5)
    // Aucun champ d'habillage UI ne doit fuiter.
    const flat = JSON.stringify(out)
    expect(flat).not.toContain('bg-')
    expect(flat).not.toContain('text-')
    expect(out.categoriesBiensSupports[0]).not.toHaveProperty('color')
    expect(out.categoriesBiensSupports[0]).not.toHaveProperty('emoji')
  })
})

describe('read_sector_examples', () => {
  it('sans secteur → liste les familles disponibles + catégories', async () => {
    const out = parse(await readSectorExamplesTool.handler({}, ctx))
    expect(out.secteur).toBeNull()
    expect(out.famillesDisponibles.some((f: { key: string }) => f.key === 'sante')).toBe(true)
    expect(out.categories).toContain('valeursMetier')
  })

  it('secteur reconnu → exemples par catégorie (valeurs métier non vides)', async () => {
    const out = parse(await readSectorExamplesTool.handler({ secteur: 'santé' }, ctx))
    expect(out.secteur).toBe('santé')
    expect(out.total).toBeGreaterThan(0)
    expect(Array.isArray(out.exemples.valeursMetier)).toBe(true)
    expect(out.exemples.valeursMetier.length).toBeGreaterThan(0)
  })

  it('filtre par catégorie unique', async () => {
    const out = parse(await readSectorExamplesTool.handler({ secteur: 'santé', category: 'biensSupports' }, ctx))
    expect(Object.keys(out.exemples)).toEqual(['biensSupports'])
  })

  it('secteur inconnu → exemples vides (pas d\'erreur)', async () => {
    const out = parse(await readSectorExamplesTool.handler({ secteur: 'zzz-inconnu' }, ctx))
    expect(out.total).toBe(0)
  })
})

describe('read_risk_posture', () => {
  beforeEach(() => { groupBy.mockReset(); findMany.mockReset(); count.mockReset(); planGroupBy.mockReset() })

  it('agrège en restant STRICTEMENT borné à l\'organisation', async () => {
    groupBy
      .mockResolvedValueOnce([{ statut: 'EN_COURS', _count: 2 }, { statut: 'TERMINE', _count: 1 }]) // parStatut
      .mockResolvedValueOnce([{ risquesResiduelsStatut: 'EN_ATTENTE', _count: 3 }])                 // parResiduel
    findMany.mockResolvedValue([
      { niveauRisque: 16, niveauResiduel: 4 },  // critique → modéré (seuil modéré ≥4)
      { niveauRisque: 9, niveauResiduel: 6 },   // élevé → modéré
      { niveauRisque: 2, niveauResiduel: 1 },   // faible → faible
    ])
    planGroupBy.mockResolvedValue([{ statut: 'A_FAIRE', _count: 5 }])
    count.mockResolvedValue(3)

    const out = parse(await readRiskPostureTool.handler({}, ctx))

    // Toutes les requêtes filtrent sur organizationId = orgA.
    expect(groupBy.mock.calls[0][0].where).toMatchObject({ organizationId: 'orgA', deletedAt: null })
    expect(findMany.mock.calls[0][0].where).toEqual({ analyse: { organizationId: 'orgA', deletedAt: null } })
    expect(planGroupBy.mock.calls[0][0].where).toEqual({ organizationId: 'orgA' })

    expect(out.analyses).toEqual({
      total: 3,
      parStatut: { EN_COURS: 2, TERMINE: 1 },
      risquesResiduels: { EN_ATTENTE: 3 },
    })
    expect(out.risques.total).toBe(3)
    expect(out.risques.parNiveauInitial).toEqual({ faible: 1, modere: 0, eleve: 1, critique: 1 })
    expect(out.risques.parNiveauResiduel).toEqual({ faible: 1, modere: 2, eleve: 0, critique: 0 })
    expect(out.plansAction).toEqual({ total: 5, parStatut: { A_FAIRE: 5 } })
  })
})
