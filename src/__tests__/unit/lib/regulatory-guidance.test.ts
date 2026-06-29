import { describe, it, expect } from 'vitest'
import { regulatoryObligations } from '@/lib/regulatory-guidance'

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
