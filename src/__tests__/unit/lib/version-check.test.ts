import { describe, it, expect } from 'vitest'
import { parseSemver, compareSemver, updateAvailable } from '@/lib/version-check'

describe('parseSemver', () => {
  it('accepte le préfixe v et ignore le pré-release', () => {
    expect(parseSemver('v1.2.3')).toEqual([1, 2, 3])
    expect(parseSemver('1.0.0-rc.1')).toEqual([1, 0, 0])
    expect(parseSemver('2.5')).toEqual([2, 5, 0])
  })
  it('valeur invalide → null', () => {
    expect(parseSemver('abc')).toBeNull()
    expect(parseSemver('')).toBeNull()
    expect(parseSemver(null)).toBeNull()
  })
})

describe('compareSemver', () => {
  it('ordonne correctement', () => {
    expect(compareSemver('1.0.0', '1.0.1')).toBe(-1)
    expect(compareSemver('1.2.0', '1.1.9')).toBe(1)
    expect(compareSemver('v2.0.0', '2.0.0')).toBe(0)
    expect(compareSemver('1.10.0', '1.9.0')).toBe(1) // numérique, pas lexicographique
  })
})

describe('updateAvailable', () => {
  it('vrai seulement si latest > current', () => {
    expect(updateAvailable('1.0.0', '1.1.0')).toBe(true)
    expect(updateAvailable('1.1.0', '1.1.0')).toBe(false)
    expect(updateAvailable('1.2.0', '1.1.0')).toBe(false)
  })
  it('versions invalides → false (pas de fausse alerte)', () => {
    expect(updateAvailable('1.0.0', 'nightly')).toBe(false)
    expect(updateAvailable(null, '1.0.0')).toBe(false)
  })
})
