// Registre des méthodes d'analyse (pur) — socle multi-méthode.
// EBIOS RM = défaut + seule méthode câblée (IMPLEMENTED_METHODS) en phase 1.
import { describe, it, expect } from 'vitest'
import {
  RISK_METHODS, DEFAULT_METHOD, IMPLEMENTED_METHODS, isRiskMethod,
  methodSteps, methodStepCount, resolveMethodes, METHOD_STEPS, cleanActiveMethodes,
  directTreatmentPhaseKey, riskTreatmentHref,
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

  it('EBIOS RM = 5 étapes ; ISO 31000 = 1 phase (écran simple) ; ISO 27005 = 5 phases ; méthode inconnue → EBIOS RM', () => {
    expect(methodStepCount('EBIOS_RM')).toBe(5)
    expect(methodStepCount('ISO_31000')).toBe(1)
    expect(methodStepCount('ISO_27005')).toBe(5)
    // Les phases des méthodes phasées portent un type.
    expect(methodSteps('ISO_27005').map(s => s.type)).toEqual(['context', 'appreciation', 'appreciation', 'review', 'appreciation'])
    // ISO 27005 différencie les phases d'appréciation (identification / analyse / traitement).
    expect(methodSteps('ISO_27005').map(s => s.apprMode)).toEqual([undefined, 'identify', 'rate', undefined, 'treat'])
    expect(methodSteps('ZZZ')).toEqual(METHOD_STEPS.EBIOS_RM) // repli
    // étapes ordonnées et numérotées
    expect(methodSteps('EBIOS_RM').map(s => s.num)).toEqual([1, 2, 3, 4, 5])
  })
})

describe('resolveMethodes — ensemble effectif', () => {
  it('les 4 méthodes sont câblées', () => {
    expect(IMPLEMENTED_METHODS).toEqual(['EBIOS_RM', 'ISO_31000', 'ISO_27005', 'NIST_800_30'])
  })

  it('sans restriction : les méthodes câblées (ordonnées), défaut EBIOS RM', () => {
    // Ordre = RISK_METHODS : EBIOS_RM, ISO_27005, NIST_800_30, ISO_31000.
    expect(resolveMethodes()).toEqual({ available: ['EBIOS_RM', 'ISO_27005', 'NIST_800_30', 'ISO_31000'], default: 'EBIOS_RM' })
  })

  it('EBIOS RM reste disponible même si l\'instance ne l\'a pas explicitement activé (garde-fou)', () => {
    const r = resolveMethodes({ instanceEnabled: ['ISO_31000'] })
    expect(r.available).toEqual(['EBIOS_RM', 'ISO_31000'])
    expect(r.default).toBe('EBIOS_RM')
  })

  it('un défaut inconnu retombe sur EBIOS RM', () => {
    const r = resolveMethodes({ orgDefault: 'MAGIQUE' })
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
    expect(cleanActiveMethodes(['garbage'])).toEqual(['EBIOS_RM']) // inconnue → écartée
    expect(cleanActiveMethodes(['garbage', 'EBIOS_RM'])).toEqual(['EBIOS_RM'])
  })
})

describe('directTreatmentPhaseKey / riskTreatmentHref', () => {
  it('phase de traitement des méthodes directes (dernière phase appreciation)', () => {
    expect(directTreatmentPhaseKey('ISO_27005')).toBe('traitement')
    expect(directTreatmentPhaseKey('ISO_31000')).toBe('appreciation')
    expect(directTreatmentPhaseKey('NIST_800_30')).toBe('maintain')
    expect(directTreatmentPhaseKey('EBIOS_RM')).toBeNull()
  })

  it('lien de traitement : EBIOS → atelier 5 ; direct → parcours phasé + deep-link phase', () => {
    expect(riskTreatmentHref('an1', 'EBIOS_RM')).toBe('/analyses/an1/atelier/5')
    expect(riskTreatmentHref('an1', 'ISO_27005')).toBe('/analyses/an1/atelier/1?phase=traitement')
    expect(riskTreatmentHref('an1', 'ISO_31000')).toBe('/analyses/an1/atelier/1?phase=appreciation')
    // méthode inconnue → repli EBIOS (atelier 5)
    expect(riskTreatmentHref('an1', 'ZZZ')).toBe('/analyses/an1/atelier/5')
  })
})
