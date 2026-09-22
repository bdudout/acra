// Priorisation + décision d'acceptation (phase Évaluation) — module pur.
import { describe, it, expect } from 'vitest'
import { acceptanceDecision, prioritise, countDecisions } from '@/lib/risque-priorisation'

describe('acceptanceDecision', () => {
  it('élevé/critique → à traiter ; faible/modéré → acceptable (aligné sur les paliers)', () => {
    expect(acceptanceDecision(16)).toBe('treat')  // critique
    expect(acceptanceDecision(12)).toBe('treat')  // critique
    expect(acceptanceDecision(8)).toBe('treat')   // élevé
    expect(acceptanceDecision(6)).toBe('accept')  // modéré
    expect(acceptanceDecision(4)).toBe('accept')  // modéré
    expect(acceptanceDecision(2)).toBe('accept')  // faible
  })
})

describe('prioritise', () => {
  it('trie par niveau décroissant et annote la décision', () => {
    const rows = [
      { id: 'a', niveauRisque: 4 },
      { id: 'b', niveauRisque: 12 },
      { id: 'c', niveauRisque: 8 },
    ]
    const out = prioritise(rows)
    expect(out.map(o => o.row.id)).toEqual(['b', 'c', 'a'])
    expect(out.map(o => o.decision)).toEqual(['treat', 'treat', 'accept'])
    // Non destructif (n'altère pas l'entrée).
    expect(rows.map(r => r.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('countDecisions', () => {
  it('compte les risques à traiter vs acceptables', () => {
    expect(countDecisions([{ niveauRisque: 12 }, { niveauRisque: 8 }, { niveauRisque: 3 }]))
      .toEqual({ treat: 2, accept: 1 })
    expect(countDecisions([])).toEqual({ treat: 0, accept: 0 })
  })
})
