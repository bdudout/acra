import { describe, expect, it } from 'vitest'
import { refsRisques } from '@/lib/risque-refs'

describe('refsRisques — numérotation R1, R2… stable d’un projet', () => {
  it('du plus critique (G×V actuel) au moins critique, égalités dans l’ordre reçu', () => {
    const refs = refsRisques([
      { id: 'a', g: 2, v: 2 },
      { id: 'b', g: 4, v: 3 },
      { id: 'c', g: 2, v: 2 },
      { id: 'd', g: 3, v: 3 },
    ])
    expect([...refs.entries()]).toEqual([['b', 'R1'], ['d', 'R2'], ['a', 'R3'], ['c', 'R4']])
  })
  it('liste vide : aucune référence', () => {
    expect(refsRisques([]).size).toBe(0)
  })
})
