import { describe, it, expect } from 'vitest'
import { buildHeatGrid, buildCartoExport, type CartoExportRisk } from '@/lib/carto-export'

function mk(p: Partial<CartoExportRisk>): CartoExportRisk {
  return {
    id: p.id ?? 'r', intitule: p.intitule ?? 'X',
    taxonomieCode: p.taxonomieCode ?? null, processusId: p.processusId ?? null,
    processusNom: p.processusNom ?? null, entite: p.entite ?? null,
    graviteInherente: p.graviteInherente ?? null, vraisemblanceInherente: p.vraisemblanceInherente ?? null,
    graviteResiduelle: p.graviteResiduelle ?? null, vraisemblanceResiduelle: p.vraisemblanceResiduelle ?? null,
    statut: p.statut ?? 'IDENTIFIE', provenance: p.provenance ?? 'MANUEL', proprietaire: p.proprietaire ?? null,
    niveauInherent: p.niveauInherent ?? null, niveauResiduel: p.niveauResiduel ?? null,
  }
}

describe('buildHeatGrid', () => {
  it('grille dense 5×5, axes ordonnés, cellules vides à 0', () => {
    const g = buildHeatGrid([mk({ graviteResiduelle: 5, vraisemblanceResiduelle: 4 })], 'residual')
    expect(g.gravites).toEqual([5, 4, 3, 2, 1])      // haut → bas
    expect(g.vraisemblances).toEqual([1, 2, 3, 4, 5]) // gauche → droite
    expect(g.counts[5][4]).toBe(1)
    expect(g.counts[1][1]).toBe(0)
    expect(g.buckets[5][4]).toBe('eleve')            // 20
  })
  it('cumule les risques d\'une même cellule', () => {
    const g = buildHeatGrid([
      mk({ graviteResiduelle: 2, vraisemblanceResiduelle: 3 }),
      mk({ graviteResiduelle: 2, vraisemblanceResiduelle: 3 }),
    ], 'residual')
    expect(g.counts[2][3]).toBe(2)
    expect(g.buckets[2][3]).toBe('moyen')            // 6
  })
})

describe('buildCartoExport', () => {
  const risks = [
    mk({ id: 'a', taxonomieCode: 'BALE_2', entite: 'DAF', processusId: 'p1', processusNom: 'Paiements', graviteResiduelle: 5, vraisemblanceResiduelle: 4 }), // 20 eleve
    mk({ id: 'b', taxonomieCode: 'BALE_2', entite: 'DSI', graviteResiduelle: 2, vraisemblanceResiduelle: 3 }), // 6 moyen
    mk({ id: 'c', taxonomieCode: null, entite: null }),                                                        // non coté
  ]
  it('synthèse, grille et ventilations cohérentes', () => {
    const d = buildCartoExport(risks, 'residual')
    expect(d.mode).toBe('residual')
    expect(d.total).toBe(3)
    expect(d.parBucket).toEqual({ faible: 0, moyen: 1, eleve: 1 })
    expect(d.nonCotes).toBe(1)
    expect(d.grid.counts[5][4]).toBe(1)
    // Catégories : BALE_2 (2 risques) puis « non renseigné » en dernier
    expect(d.parCategorie.map(c => c.key)).toEqual(['BALE_2', ''])
    expect(d.parCategorie[0].count).toBe(2)
    expect(d.parCategorie[0].maxNiveau).toBe(20)
    // Processus : p1 en tête (coté), puis le bucket vide
    expect(d.parProcessus[0].key).toBe('p1')
    expect(d.parProcessus[0].label).toBe('Paiements')
    // Entités : DAF (20) avant DSI (6), « non renseigné » en dernier
    expect(d.parEntite.map(e => e.key)).toEqual(['DAF', 'DSI', ''])
  })
  it('mode inhérent utilise les cotes inhérentes', () => {
    const d = buildCartoExport([mk({ graviteInherente: 5, vraisemblanceInherente: 5, graviteResiduelle: 1, vraisemblanceResiduelle: 1 })], 'inherent')
    expect(d.grid.counts[5][5]).toBe(1)
    expect(d.parBucket.eleve).toBe(1)
  })
  it('périmètre vide', () => {
    const d = buildCartoExport([], 'residual')
    expect(d.total).toBe(0)
    expect(d.nonCotes).toBe(0)
    expect(d.parCategorie).toEqual([])
  })
})
