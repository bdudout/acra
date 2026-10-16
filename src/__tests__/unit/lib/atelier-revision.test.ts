import { describe, it, expect } from 'vitest'
import { revisionField, parseIfMatch } from '@/lib/atelier-revision'

describe('revisionField', () => {
  it('un compteur par atelier 1 à 5', () => {
    expect(revisionField(1)).toBe('revisionAtelier1')
    expect(revisionField(5)).toBe('revisionAtelier5')
  })
  it('atelier hors 1-5 → null', () => {
    expect(revisionField(0)).toBeNull()
    expect(revisionField(6)).toBeNull()
    expect(revisionField(Number.NaN)).toBeNull()
  })
})

describe('parseIfMatch', () => {
  it('accepte un entier positif, nu ou entre guillemets (ETag)', () => {
    expect(parseIfMatch('3')).toBe(3)
    expect(parseIfMatch('"12"')).toBe(12)
    expect(parseIfMatch('0')).toBe(0)
  })
  it('absent ou invalide → null (aucun contrôle de conflit, compatibilité)', () => {
    expect(parseIfMatch(null)).toBeNull()
    expect(parseIfMatch('')).toBeNull()
    expect(parseIfMatch('*')).toBeNull()
    expect(parseIfMatch('-1')).toBeNull()
    expect(parseIfMatch('1.5')).toBeNull()
    expect(parseIfMatch('abc')).toBeNull()
  })
})
