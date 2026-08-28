import { describe, it, expect } from 'vitest'
import { rankSuggestions, SUGGESTION_FIELDS, isSuggestionField } from '@/lib/suggestions'

describe('rankSuggestions', () => {
  it('déduplique (insensible à la casse) en gardant la 1ʳᵉ graphie', () => {
    expect(rankSuggestions(['Acme', 'acme', 'ACME'], '')).toEqual(['Acme'])
  })
  it('ignore les valeurs vides / non-chaînes', () => {
    expect(rankSuggestions(['  ', null, undefined, 'Banque', ''], '')).toEqual(['Banque'])
  })
  it('sans requête : tri alphabétique', () => {
    expect(rankSuggestions(['Zeta', 'alpha', 'Béta'], '')).toEqual(['alpha', 'Béta', 'Zeta'])
  })
  it('avec requête : sous-chaîne, préfixes d’abord, exclut l’égalité exacte', () => {
    const r = rankSuggestions(['Banque Populaire', 'Crédit Banque', 'banque', 'Autre'], 'banque')
    expect(r).toEqual(['Banque Populaire', 'Crédit Banque']) // 'banque' exact exclu, préfixe avant sous-chaîne
  })
  it('respecte la limite', () => {
    expect(rankSuggestions(['a', 'b', 'c', 'd'], '', 2)).toHaveLength(2)
  })
})

describe('champs whitelistés', () => {
  it('isSuggestionField', () => {
    expect(isSuggestionField('organisation')).toBe(true)
    expect(isSuggestionField('tag')).toBe(true)
    expect(isSuggestionField('sourceRisque')).toBe(true)
    expect(isSuggestionField('partiePrenante')).toBe(true)
    expect(isSuggestionField('mesure')).toBe(true)
    expect(isSuggestionField('password')).toBe(false)
    expect(SUGGESTION_FIELDS.length).toBeGreaterThanOrEqual(5)
  })
})
