import { describe, it, expect } from 'vitest'
// Import relatif volontaire : sous Node 26 l'alias @/ casse vitest sur l'hôte.
import {
  ETATS_SOCLE,
  normalizeEtatSocle,
  etatSocleFromEntry,
} from '../../../lib/socle-etat'

describe('socle-etat', () => {
  it('expose les 3 états d\'application (EXI_M1_20)', () => {
    expect(ETATS_SOCLE).toEqual(['APPLIQUE', 'PARTIEL', 'NON_APPLIQUE'])
  })

  describe('normalizeEtatSocle', () => {
    it('laisse passer un état connu', () => {
      expect(normalizeEtatSocle('PARTIEL')).toBe('PARTIEL')
      expect(normalizeEtatSocle('NON_APPLIQUE')).toBe('NON_APPLIQUE')
    })
    it('normalise la casse', () => {
      expect(normalizeEtatSocle('applique')).toBe('APPLIQUE')
    })
    it('retombe sur APPLIQUE pour une valeur inconnue/vide', () => {
      expect(normalizeEtatSocle('')).toBe('APPLIQUE')
      expect(normalizeEtatSocle(null)).toBe('APPLIQUE')
      expect(normalizeEtatSocle('bidon')).toBe('APPLIQUE')
    })
  })

  describe('etatSocleFromEntry (rétro-compatibilité des analyses existantes)', () => {
    it('utilise etatApplication quand présent', () => {
      expect(etatSocleFromEntry({ nom: 'ISO', etatApplication: 'PARTIEL' })).toBe('PARTIEL')
    })
    it('déduit NON_APPLIQUE si applicable === false', () => {
      expect(etatSocleFromEntry({ nom: 'ISO', applicable: false })).toBe('NON_APPLIQUE')
    })
    it('déduit PARTIEL si des écarts sont renseignés', () => {
      expect(etatSocleFromEntry({ nom: 'ISO', applicable: true, ecarts: 'MFA partielle' })).toBe('PARTIEL')
    })
    it('APPLIQUE par défaut (applicable, sans écart)', () => {
      expect(etatSocleFromEntry({ nom: 'ISO', applicable: true, ecarts: '' })).toBe('APPLIQUE')
      expect(etatSocleFromEntry({ nom: 'ISO' })).toBe('APPLIQUE')
    })
    it('etatApplication prime sur les champs dérivés', () => {
      expect(etatSocleFromEntry({ nom: 'ISO', applicable: false, etatApplication: 'APPLIQUE' })).toBe('APPLIQUE')
    })
  })
})
