import { describe, it, expect } from 'vitest'
// Import relatif volontaire : sous Node 26 l'alias @/ casse vitest sur l'hôte.
import {
  METHODES_VRAISEMBLANCE,
  normalizeMethode,
  aggregateVraisemblance,
} from '../../../lib/vraisemblance-methode'

describe('vraisemblance-methode (EXI_M4_07/10/11/14)', () => {
  it('expose les 3 méthodes', () => {
    expect(METHODES_VRAISEMBLANCE).toEqual(['EXPRESSE', 'STANDARD', 'AVANCEE'])
  })

  describe('normalizeMethode', () => {
    it('laisse passer / normalise la casse', () => {
      expect(normalizeMethode('STANDARD')).toBe('STANDARD')
      expect(normalizeMethode('avancee')).toBe('AVANCEE')
    })
    it('défaut EXPRESSE', () => {
      expect(normalizeMethode('')).toBe('EXPRESSE')
      expect(normalizeMethode(null)).toBe('EXPRESSE')
      expect(normalizeMethode('autre')).toBe('EXPRESSE')
    })
  })

  describe('aggregateVraisemblance', () => {
    it('renvoie null pour la méthode expresse (vraisemblance saisie manuellement)', () => {
      expect(aggregateVraisemblance([{ probabiliteSucces: 3 }], 'EXPRESSE')).toBeNull()
    })

    it('renvoie null sans action à agréger', () => {
      expect(aggregateVraisemblance([], 'STANDARD')).toBeNull()
      expect(aggregateVraisemblance(null, 'STANDARD')).toBeNull()
    })

    it('méthode standard = moyenne des probabilités de succès (arrondi, borné 1..4)', () => {
      expect(aggregateVraisemblance([{ probabiliteSucces: 3 }, { probabiliteSucces: 3 }, { probabiliteSucces: 4 }], 'STANDARD')).toBe(3)
      expect(aggregateVraisemblance([{ probabiliteSucces: 1 }, { probabiliteSucces: 2 }], 'STANDARD')).toBe(2) // 1.5 → 2
      expect(aggregateVraisemblance([{}], 'STANDARD')).toBe(2) // défaut 2
    })

    it('méthode avancée = probabilité pénalisée par la difficulté technique', () => {
      // probs moyenne 3.33 ; difficulté 2 → pénalité 0,5 → 2,83 → 3
      expect(aggregateVraisemblance(
        [{ probabiliteSucces: 3, difficulteTechnique: 2 }, { probabiliteSucces: 3, difficulteTechnique: 2 }, { probabiliteSucces: 4, difficulteTechnique: 2 }],
        'AVANCEE',
      )).toBe(3)
      // même probs, difficulté maximale 4 → pénalité 1,5 → 1,83 → 2
      expect(aggregateVraisemblance(
        [{ probabiliteSucces: 3, difficulteTechnique: 4 }, { probabiliteSucces: 3, difficulteTechnique: 4 }, { probabiliteSucces: 4, difficulteTechnique: 4 }],
        'AVANCEE',
      )).toBe(2)
    })

    it('borne le résultat entre 1 et 4', () => {
      expect(aggregateVraisemblance([{ probabiliteSucces: 1, difficulteTechnique: 4 }], 'AVANCEE')).toBe(1)
      expect(aggregateVraisemblance([{ probabiliteSucces: 4, difficulteTechnique: 1 }], 'AVANCEE')).toBe(4)
    })
  })
})
