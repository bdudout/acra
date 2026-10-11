// Recette n° 14 : l'avancement d'une analyse (atelier courant) ne progresse que sur l'action explicite « Passer à
// l'atelier suivant », jamais sur une sauvegarde automatique ; il ne recule jamais et plafonne à l'atelier 5.
import { describe, expect, it } from 'vitest'
import { atelierApresAvancement } from '@/lib/analyse-avancement'

describe('atelierApresAvancement', () => {
  it('passe à l’atelier suivant, sans reculer ni dépasser 5', () => {
    expect(atelierApresAvancement(1, 1)).toBe(2)
    expect(atelierApresAvancement(4, 2)).toBe(4) // revenir sur l'atelier 2 puis « suivant » ne fait pas reculer
    expect(atelierApresAvancement(5, 5)).toBe(5)
    expect(atelierApresAvancement(1, 9)).toBe(5)
  })
})
