import { describe, it, expect } from 'vitest'
import { regulatoryObligations, suggestsComplianceModule } from '@/lib/regulatory-guidance'

// Obligations réglementaires différenciées selon le statut (issue #68).

describe('regulatoryObligations', () => {
  it('OIV → 3 obligations dont la soumission à l\'ANSSI et l\'exercice de crise', () => {
    const o = regulatoryObligations('OIV')
    expect(o).toContain('oivAnssiSubmit')
    expect(o).toContain('oivSectorGuide')
    expect(o).toContain('oivCrisisExercise')
    expect(o.length).toBe(3)
  })
  it('EEI (NIS2) → obligations NIS2 (notification d\'incident)', () => {
    const o = regulatoryObligations('EEI')
    expect(o.length).toBeGreaterThan(0)
    expect(o).toContain('eeiIncident')
  })
  it('OSE (NIS1) → au moins une obligation', () => {
    expect(regulatoryObligations('OSE').length).toBeGreaterThan(0)
  })
  it('aucun / null / inconnu → []', () => {
    expect(regulatoryObligations('aucun')).toEqual([])
    expect(regulatoryObligations(null)).toEqual([])
    expect(regulatoryObligations(undefined)).toEqual([])
    expect(regulatoryObligations('xxx')).toEqual([])
  })
})

describe('suggestsComplianceModule (issue #73)', () => {
  it('vrai pour les secteurs réglementés (NIS2 / régulés)', () => {
    for (const s of ['Banque / Finance', 'Santé / Médico-social', 'Énergie / Utilities',
      'Administration publique', 'Eau / Assainissement', 'Télécommunications', 'Défense / Sécurité nationale']) {
      expect(suggestsComplianceModule(s)).toBe(true)
    }
  })
  it('vrai dès qu\'un statut réglementaire est renseigné (même secteur neutre)', () => {
    expect(suggestsComplianceModule('Médias / Culture', 'EEI')).toBe(true)
    expect(suggestsComplianceModule(null, 'OIV')).toBe(true)
  })
  it('faux pour un secteur non réglementé sans statut', () => {
    expect(suggestsComplianceModule('Médias / Culture')).toBe(false)
    expect(suggestsComplianceModule('Tourisme / Hôtellerie-restauration', 'aucun')).toBe(false)
    expect(suggestsComplianceModule('')).toBe(false)
    expect(suggestsComplianceModule(null)).toBe(false)
  })
})
