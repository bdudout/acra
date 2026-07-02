import { describe, it, expect } from 'vitest'
import { isNonEmptyText, hasCadrageContexte } from '../../../lib/pdf-guards'

// Régression : cadrage avec perimetre/objectifsEtude = '' (chaînes vides, pas null)
// → l'ancien guard `{(perimetre || objectifsEtude) && <View/>}` rendait '' comme
// enfant direct de <Page>, d'où « Invalid '' string child outside <Text> » et un
// export PDF cassé (cas « ARS Notaire de Trifouillis »). Les gardes doivent
// retourner un booléen strict.

describe('isNonEmptyText', () => {
  it('false pour chaîne vide, espaces, null, undefined, non-string', () => {
    expect(isNonEmptyText('')).toBe(false)
    expect(isNonEmptyText('   ')).toBe(false)
    expect(isNonEmptyText(null)).toBe(false)
    expect(isNonEmptyText(undefined)).toBe(false)
    expect(isNonEmptyText(0)).toBe(false)
  })
  it('true pour chaîne non vide', () => {
    expect(isNonEmptyText('x')).toBe(true)
    expect(isNonEmptyText('  Périmètre  ')).toBe(true)
  })
})

describe('hasCadrageContexte', () => {
  it('false si cadrage absent', () => {
    expect(hasCadrageContexte(null)).toBe(false)
    expect(hasCadrageContexte(undefined)).toBe(false)
  })
  it('false — strictement booléen — quand perimetre et objectifsEtude sont vides', () => {
    const r = hasCadrageContexte({ perimetre: '', objectifsEtude: '' })
    expect(r).toBe(false) // et surtout PAS '' (sinon enfant chaîne vide dans <Page>)
    expect(typeof r).toBe('boolean')
  })
  it('true si au moins un des deux champs est renseigné', () => {
    expect(hasCadrageContexte({ perimetre: 'X', objectifsEtude: '' })).toBe(true)
    expect(hasCadrageContexte({ perimetre: '', objectifsEtude: 'Y' })).toBe(true)
  })
})
