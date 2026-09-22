// Registre des méthodes d'analyse (pur) — socle multi-méthode.
// EBIOS RM = défaut + seule méthode câblée (IMPLEMENTED_METHODS) en phase 1.
import { describe, it, expect } from 'vitest'
import {
  RISK_METHODS, DEFAULT_METHOD, IMPLEMENTED_METHODS, isRiskMethod,
  methodSteps, methodStepCount, resolveMethodes, METHOD_STEPS,
} from '@/lib/methodes'

describe('registre des méthodes', () => {
  it('EBIOS_RM est le défaut et fait partie des méthodes connues', () => {
    expect(DEFAULT_METHOD).toBe('EBIOS_RM')
    expect(RISK_METHODS).toContain('EBIOS_RM')
    expect(RISK_METHODS).toContain('ISO_31000')
  })

  it('isRiskMethod reconnaît les méthodes connues et rejette le reste', () => {
    expect(isRiskMethod('EBIOS_RM')).toBe(true)
    expect(isRiskMethod('ISO_31000')).toBe(true)
    expect(isRiskMethod('MAGIQUE')).toBe(false)
    expect(isRiskMethod(null)).toBe(false)
  })

  it('EBIOS RM = 5 étapes ; ISO 31000 = 3 étapes ; méthode inconnue → EBIOS RM', () => {
    expect(methodStepCount('EBIOS_RM')).toBe(5)
    expect(methodStepCount('ISO_31000')).toBe(3)
    expect(methodSteps('ZZZ')).toEqual(METHOD_STEPS.EBIOS_RM) // repli
    // étapes ordonnées et numérotées
    expect(methodSteps('EBIOS_RM').map(s => s.num)).toEqual([1, 2, 3, 4, 5])
  })
})

describe('resolveMethodes — ensemble effectif', () => {
  it('par défaut : seul EBIOS RM (seule méthode câblée)', () => {
    expect(resolveMethodes()).toEqual({ available: ['EBIOS_RM'], default: 'EBIOS_RM' })
  })

  it('EBIOS RM reste disponible même si l\'instance ne l\'a pas explicitement activé (garde-fou)', () => {
    const r = resolveMethodes({ instanceEnabled: ['ISO_31000'] })
    expect(r.available).toContain('EBIOS_RM')
    expect(r.default).toBe('EBIOS_RM')
  })

  it('une méthode non câblée demandée par défaut retombe sur EBIOS RM', () => {
    // ISO_31000 n'est pas encore dans IMPLEMENTED_METHODS → indisponible.
    expect(IMPLEMENTED_METHODS).toEqual(['EBIOS_RM'])
    const r = resolveMethodes({ orgDefault: 'ISO_31000' })
    expect(r.available).not.toContain('ISO_31000')
    expect(r.default).toBe('EBIOS_RM')
  })
})
