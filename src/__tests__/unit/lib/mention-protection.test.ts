import { describe, it, expect } from 'vitest'
// Import relatif volontaire : sous Node 26 l'alias @/ casse vitest sur l'hôte.
import {
  MENTIONS_PROTECTION,
  normalizeMentionProtection,
  isProtectedMention,
} from '../../../lib/mention-protection'

describe('mention-protection', () => {
  it('expose les 4 niveaux du cahier des charges, dans l\'ordre croissant de protection', () => {
    expect(MENTIONS_PROTECTION).toEqual([
      'NON_PROTEGEE',
      'SENSIBLE',
      'RESTREINTE',
      'CONFIDENTIELLE',
    ])
  })

  describe('normalizeMentionProtection', () => {
    it('laisse passer une valeur connue', () => {
      expect(normalizeMentionProtection('RESTREINTE')).toBe('RESTREINTE')
      expect(normalizeMentionProtection('CONFIDENTIELLE')).toBe('CONFIDENTIELLE')
    })

    it('normalise la casse', () => {
      expect(normalizeMentionProtection('sensible')).toBe('SENSIBLE')
      expect(normalizeMentionProtection('Confidentielle')).toBe('CONFIDENTIELLE')
    })

    it('retombe sur NON_PROTEGEE pour une valeur inconnue ou vide', () => {
      expect(normalizeMentionProtection('secret défense')).toBe('NON_PROTEGEE')
      expect(normalizeMentionProtection('')).toBe('NON_PROTEGEE')
      expect(normalizeMentionProtection(null)).toBe('NON_PROTEGEE')
      expect(normalizeMentionProtection(undefined)).toBe('NON_PROTEGEE')
      expect(normalizeMentionProtection(42)).toBe('NON_PROTEGEE')
    })
  })

  describe('isProtectedMention', () => {
    it('est faux uniquement pour NON_PROTEGEE', () => {
      expect(isProtectedMention('NON_PROTEGEE')).toBe(false)
      expect(isProtectedMention(null)).toBe(false)
      expect(isProtectedMention('inconnu')).toBe(false)
    })

    it('est vrai dès qu\'une protection s\'applique', () => {
      expect(isProtectedMention('SENSIBLE')).toBe(true)
      expect(isProtectedMention('RESTREINTE')).toBe(true)
      expect(isProtectedMention('CONFIDENTIELLE')).toBe(true)
    })
  })
})
