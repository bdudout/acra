import { describe, it, expect } from 'vitest'
import {
  coupleFor, niveauBucket, buildHeatmap, aggregateByDimension, type CartoRisk,
} from '@/lib/cartographie'

function mk(p: Partial<CartoRisk>): CartoRisk {
  return {
    id: p.id ?? 'r', intitule: p.intitule ?? 'X',
    taxonomieCode: p.taxonomieCode ?? null, processusId: p.processusId ?? null,
    processusNom: p.processusNom ?? null, entite: p.entite ?? null,
    graviteInherente: p.graviteInherente ?? null, vraisemblanceInherente: p.vraisemblanceInherente ?? null,
    graviteResiduelle: p.graviteResiduelle ?? null, vraisemblanceResiduelle: p.vraisemblanceResiduelle ?? null,
  }
}

describe('coupleFor', () => {
  it('choisit le couple selon le mode', () => {
    const r = mk({ graviteInherente: 5, vraisemblanceInherente: 4, graviteResiduelle: 2, vraisemblanceResiduelle: 1 })
    expect(coupleFor(r, 'inherent')).toEqual({ g: 5, v: 4 })
    expect(coupleFor(r, 'residual')).toEqual({ g: 2, v: 1 })
  })
  it('null si cotation incomplète', () => {
    expect(coupleFor(mk({ graviteInherente: 3 }), 'inherent')).toBeNull()
    expect(coupleFor(mk({ graviteResiduelle: 3, vraisemblanceResiduelle: 3 }), 'inherent')).toBeNull()
  })
})

describe('niveauBucket', () => {
  it('seuils alignés sur le registre', () => {
    expect(niveauBucket(20)).toBe('eleve')
    expect(niveauBucket(12)).toBe('eleve')
    expect(niveauBucket(11)).toBe('moyen')
    expect(niveauBucket(6)).toBe('moyen')
    expect(niveauBucket(5)).toBe('faible')
    expect(niveauBucket(1)).toBe('faible')
  })
})

describe('buildHeatmap', () => {
  it('regroupe par cellule, compte cotés/non cotés et par palier', () => {
    const risks = [
      mk({ id: 'a', graviteInherente: 5, vraisemblanceInherente: 4 }), // 20 eleve
      mk({ id: 'b', graviteInherente: 5, vraisemblanceInherente: 4 }), // 20 eleve (même cellule)
      mk({ id: 'c', graviteInherente: 2, vraisemblanceInherente: 3 }), // 6 moyen
      mk({ id: 'd', graviteInherente: 1, vraisemblanceInherente: 2 }), // 2 faible
      mk({ id: 'e' }),                                                 // non coté
    ]
    const h = buildHeatmap(risks, 'inherent')
    expect(h.totalCote).toBe(4)
    expect(h.totalNonCote).toBe(1)
    expect(h.parBucket).toEqual({ faible: 1, moyen: 1, eleve: 2 })
    const top = h.cells.find(c => c.gravite === 5 && c.vraisemblance === 4)!
    expect(top.risqueIds).toEqual(['a', 'b'])
    expect(top.niveau).toBe(20)
    expect(top.bucket).toBe('eleve')
    // triées g asc puis v asc
    expect(h.cells.map(c => `${c.gravite}:${c.vraisemblance}`)).toEqual(['1:2', '2:3', '5:4'])
  })
})

describe('aggregateByDimension', () => {
  const risks = [
    mk({ id: 'a', taxonomieCode: 'BALE_2', graviteInherente: 5, vraisemblanceInherente: 4 }),   // 20
    mk({ id: 'b', taxonomieCode: 'BALE_2', graviteInherente: 2, vraisemblanceInherente: 2 }),   // 4
    mk({ id: 'c', taxonomieCode: 'BALE_1', graviteInherente: 3, vraisemblanceInherente: 3 }),   // 9
    mk({ id: 'd', taxonomieCode: null }),                                                        // non renseigné + non coté
  ]
  it('groupe par taxonomie, trie par maxNiveau décroissant, non-renseigné en dernier', () => {
    const agg = aggregateByDimension(risks, 'taxonomie', 'inherent')
    expect(agg.map(b => b.key)).toEqual(['BALE_2', 'BALE_1', ''])
    const bale2 = agg[0]
    expect(bale2.count).toBe(2)
    expect(bale2.cote).toBe(2)
    expect(bale2.maxNiveau).toBe(20)
    expect(bale2.pireBucket).toBe('eleve')
    const nonRenseigne = agg[2]
    expect(nonRenseigne.count).toBe(1)
    expect(nonRenseigne.cote).toBe(0)
    expect(nonRenseigne.maxNiveau).toBeNull()
  })
  it('dimension processus expose le libellé', () => {
    const agg = aggregateByDimension(
      [mk({ id: 'x', processusId: 'p1', processusNom: 'Paiements', graviteInherente: 4, vraisemblanceInherente: 4 })],
      'processus', 'inherent',
    )
    expect(agg[0].key).toBe('p1')
    expect(agg[0].label).toBe('Paiements')
    expect(agg[0].maxNiveau).toBe(16)
  })
})
