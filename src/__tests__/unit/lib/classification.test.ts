import { describe, it, expect } from 'vitest'
import { CLASSIFICATIONS, normalizeClassification, isClassified } from '@/lib/classification'

// Classification de l'information IGI-1300 (GitHub backlog #28).

describe('classification de l’information', () => {
  it('expose les 4 niveaux NP/DR/S/TS', () => {
    expect(CLASSIFICATIONS).toEqual(['NP', 'DR', 'S', 'TS'])
  })
  it('normalise vers un niveau connu, défaut NP', () => {
    expect(normalizeClassification('DR')).toBe('DR')
    expect(normalizeClassification('dr')).toBe('DR')
    expect(normalizeClassification('')).toBe('NP')
    expect(normalizeClassification(undefined)).toBe('NP')
    expect(normalizeClassification('XYZ')).toBe('NP')
  })
  it('isClassified vrai seulement au-delà de NP', () => {
    expect(isClassified('NP')).toBe(false)
    expect(isClassified(undefined)).toBe(false)
    expect(isClassified('DR')).toBe(true)
    expect(isClassified('S')).toBe(true)
    expect(isClassified('TS')).toBe(true)
  })
})
