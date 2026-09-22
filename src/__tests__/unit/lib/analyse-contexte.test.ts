// Contexte d'appréciation (périmètre + objectifs/critères) — module pur.
import { describe, it, expect } from 'vitest'
import { sanitizeContexte, CONTEXTE_MAX_LEN } from '@/lib/analyse-contexte'

describe('sanitizeContexte', () => {
  it('nettoie et borne les chaînes (trim)', () => {
    expect(sanitizeContexte({ perimetre: '  SI de production  ', objectifsEtude: '  Confidentialité  ' }))
      .toEqual({ perimetre: 'SI de production', objectifsEtude: 'Confidentialité' })
  })

  it('les valeurs non-chaînes ou absentes deviennent une chaîne vide', () => {
    expect(sanitizeContexte({ perimetre: 42, objectifsEtude: null })).toEqual({ perimetre: '', objectifsEtude: '' })
    expect(sanitizeContexte({})).toEqual({ perimetre: '', objectifsEtude: '' })
    expect(sanitizeContexte(null)).toEqual({ perimetre: '', objectifsEtude: '' })
    expect(sanitizeContexte('nope')).toEqual({ perimetre: '', objectifsEtude: '' })
  })

  it('borne la longueur à CONTEXTE_MAX_LEN', () => {
    const long = 'a'.repeat(CONTEXTE_MAX_LEN + 500)
    const out = sanitizeContexte({ perimetre: long, objectifsEtude: long })
    expect(out.perimetre.length).toBe(CONTEXTE_MAX_LEN)
    expect(out.objectifsEtude.length).toBe(CONTEXTE_MAX_LEN)
  })
})
