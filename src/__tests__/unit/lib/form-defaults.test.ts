import { describe, it, expect } from 'vitest'
import { todayInputDate, suggestionsFromValues, defaultResponsable } from '@/lib/form-defaults'

describe('todayInputDate', () => {
  it('formate une date en YYYY-MM-DD (heure locale)', () => {
    // 2026-03-09 (mois et jour < 10 → zéro-padding)
    const d = new Date(2026, 2, 9, 14, 30, 0)
    expect(todayInputDate(d)).toBe('2026-03-09')
  })

  it('zéro-pad correctement décembre et le 31', () => {
    expect(todayInputDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
  })

  it('utilise les composantes locales, pas UTC', () => {
    // 1er janvier 00:30 locale : la date locale est bien le 01, pas le 31/12 UTC.
    const d = new Date(2026, 0, 1, 0, 30)
    expect(todayInputDate(d)).toBe('2026-01-01')
  })

  it('sans argument, renvoie une chaîne au format attendu', () => {
    expect(todayInputDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('suggestionsFromValues', () => {
  it('retourne les valeurs distinctes, non vides, triées', () => {
    expect(suggestionsFromValues(['Banque', 'Assurance', 'Banque'])).toEqual(['Assurance', 'Banque'])
  })

  it('ignore null, undefined et chaînes vides/espaces', () => {
    expect(suggestionsFromValues(['Alice', null, undefined, '', '   ', 'Bob'])).toEqual(['Alice', 'Bob'])
  })

  it('trim les valeurs', () => {
    expect(suggestionsFromValues(['  Alice  ', 'Bob'])).toEqual(['Alice', 'Bob'])
  })

  it('dédoublonne sans tenir compte de la casse et des accents, garde la 1re occurrence', () => {
    expect(suggestionsFromValues(['Éric', 'eric', 'ERIC'])).toEqual(['Éric'])
  })

  it('respecte la limite', () => {
    const many = Array.from({ length: 100 }, (_, i) => `v${String(i).padStart(3, '0')}`)
    const out = suggestionsFromValues(many, 10)
    expect(out).toHaveLength(10)
    expect(out[0]).toBe('v000')
  })

  it('renvoie un tableau vide pour une entrée vide', () => {
    expect(suggestionsFromValues([])).toEqual([])
  })
})

describe('defaultResponsable', () => {
  it('renvoie le nom trimé de l\'utilisateur courant', () => {
    expect(defaultResponsable('  RSSI StarBank  ')).toBe('RSSI StarBank')
  })

  it('renvoie une chaîne vide si nom absent', () => {
    expect(defaultResponsable(null)).toBe('')
    expect(defaultResponsable(undefined)).toBe('')
    expect(defaultResponsable('   ')).toBe('')
  })
})
