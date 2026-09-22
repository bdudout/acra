// Registre des méthodes d'analyse (pur) — socle multi-méthode.
// EBIOS RM = défaut + seule méthode câblée (IMPLEMENTED_METHODS) en phase 1.
import { describe, it, expect } from 'vitest'
import {
  RISK_METHODS, DEFAULT_METHOD, IMPLEMENTED_METHODS, isRiskMethod,
  methodSteps, methodStepCount, resolveMethodes, METHOD_STEPS, cleanActiveMethodes,
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
  it('EBIOS RM, ISO 31000 et ISO 27005 sont câblés', () => {
    expect(IMPLEMENTED_METHODS).toEqual(['EBIOS_RM', 'ISO_31000', 'ISO_27005'])
  })

  it('sans restriction : les méthodes câblées (ordonnées), défaut EBIOS RM', () => {
    // Ordre = RISK_METHODS : EBIOS_RM, ISO_27005, ISO_31000.
    expect(resolveMethodes()).toEqual({ available: ['EBIOS_RM', 'ISO_27005', 'ISO_31000'], default: 'EBIOS_RM' })
  })

  it('EBIOS RM reste disponible même si l\'instance ne l\'a pas explicitement activé (garde-fou)', () => {
    const r = resolveMethodes({ instanceEnabled: ['ISO_31000'] })
    expect(r.available).toEqual(['EBIOS_RM', 'ISO_31000'])
    expect(r.default).toBe('EBIOS_RM')
  })

  it('une méthode non câblée demandée par défaut retombe sur EBIOS RM', () => {
    // NIST_800_30 n'est pas encore dans IMPLEMENTED_METHODS → indisponible.
    const r = resolveMethodes({ orgDefault: 'NIST_800_30' })
    expect(r.available).not.toContain('NIST_800_30')
    expect(r.default).toBe('EBIOS_RM')
  })

  it('défaut d\'organisation honoré s\'il est disponible (ISO 31000)', () => {
    expect(resolveMethodes({ orgDefault: 'ISO_31000' }).default).toBe('ISO_31000')
  })
})

describe('cleanActiveMethodes — activation instance', () => {
  it('impose EBIOS RM et ne garde que les méthodes câblées connues', () => {
    expect(cleanActiveMethodes(['ISO_31000'])).toEqual(['EBIOS_RM', 'ISO_31000'])
    expect(cleanActiveMethodes(null)).toEqual(['EBIOS_RM'])
    expect(cleanActiveMethodes(['NIST_800_30'])).toEqual(['EBIOS_RM']) // non câblée → écartée
    expect(cleanActiveMethodes(['garbage', 'EBIOS_RM'])).toEqual(['EBIOS_RM'])
  })
})
