import { describe, it, expect } from 'vitest'
// Import relatif volontaire : sous Node 26 l'alias @/ casse vitest sur l'hôte.
import { OPERATEURS_AE, normalizeOperateur } from '../../../lib/operateur-ae'

describe('operateur-ae (opérateurs ET/OU des modes opératoires, EXI_M4_06)', () => {
  it('expose les 2 opérateurs', () => {
    expect(OPERATEURS_AE).toEqual(['ET', 'OU'])
  })

  it('laisse passer un opérateur connu et normalise la casse', () => {
    expect(normalizeOperateur('ET')).toBe('ET')
    expect(normalizeOperateur('ou')).toBe('OU')
  })

  it('retombe sur ET par défaut (enchaînement conjonctif)', () => {
    expect(normalizeOperateur('')).toBe('ET')
    expect(normalizeOperateur(null)).toBe('ET')
    expect(normalizeOperateur('xor')).toBe('ET')
  })
})
