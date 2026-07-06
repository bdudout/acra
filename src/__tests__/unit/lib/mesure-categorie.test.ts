import { describe, it, expect } from 'vitest'
// Import relatif volontaire : sous Node 26 l'alias @/ casse vitest sur l'hôte.
import {
  CATEGORIES_MESURE_EBIOS,
  normalizeCategorieMesure,
} from '../../../lib/mesure-categorie'

describe('mesure-categorie (EBIOS RM fiche méthode n°9, EXI_M5_06)', () => {
  it('expose les 4 catégories de mesures EBIOS, dans l\'ordre du guide', () => {
    expect(CATEGORIES_MESURE_EBIOS).toEqual([
      'GOUVERNANCE',
      'PROTECTION',
      'DEFENSE',
      'RESILIENCE',
    ])
  })

  describe('normalizeCategorieMesure', () => {
    it('laisse passer une catégorie connue', () => {
      expect(normalizeCategorieMesure('GOUVERNANCE')).toBe('GOUVERNANCE')
      expect(normalizeCategorieMesure('RESILIENCE')).toBe('RESILIENCE')
    })
    it('normalise la casse', () => {
      expect(normalizeCategorieMesure('defense')).toBe('DEFENSE')
    })
    it('retombe sur PROTECTION pour une valeur inconnue/vide', () => {
      expect(normalizeCategorieMesure('')).toBe('PROTECTION')
      expect(normalizeCategorieMesure(null)).toBe('PROTECTION')
      expect(normalizeCategorieMesure('autre')).toBe('PROTECTION')
      expect(normalizeCategorieMesure(7)).toBe('PROTECTION')
    })
  })
})
