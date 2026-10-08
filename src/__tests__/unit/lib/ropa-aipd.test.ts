// Suivi de l'AIPD d'un traitement (RGPD art. 35-36) : statut, rattachement à une analyse, justification d'une AIPD non
// retenue (décision documentée), consultation préalable de l'autorité de contrôle.
import { describe, it, expect } from 'vitest'
import { sanitizeSuiviAipd, alerteAipd, validerSuiviAipd, STATUTS_AIPD } from '@/lib/ropa-aipd'

describe('sanitizeSuiviAipd', () => {
  it('statut connu ou nul, date ISO, justification bornée', () => {
    expect(STATUTS_AIPD).toEqual(['A_REALISER', 'EN_COURS', 'REALISEE', 'NON_RETENUE'])
    expect(sanitizeSuiviAipd({ aipdStatut: 'REALISEE', aipdAnalyseId: 'a1', aipdDate: '2026-10-01', aipdJustification: '  ok ', aipdConsultationPrealable: true }))
      .toEqual({ aipdStatut: 'REALISEE', aipdAnalyseId: 'a1', aipdDate: new Date('2026-10-01'), aipdJustification: 'ok', aipdConsultationPrealable: true })
    expect(sanitizeSuiviAipd({ aipdStatut: 'PEUT-ETRE', aipdDate: 'demain' })).toMatchObject({ aipdStatut: null, aipdDate: null, aipdAnalyseId: null })
  })
})

describe('alerteAipd', () => {
  it('AIPD requise non engagée → à lancer ; engagée → rien', () => {
    expect(alerteAipd('REQUISE', { aipdStatut: null, aipdJustification: '' })).toBe('A_LANCER')
    expect(alerteAipd('REQUISE', { aipdStatut: 'A_REALISER', aipdJustification: '' })).toBe('A_LANCER')
    expect(alerteAipd('REQUISE', { aipdStatut: 'EN_COURS', aipdJustification: '' })).toBeNull()
  })
  it('non retenue sans justification alors qu’un critère est présent → justification requise', () => {
    expect(alerteAipd('A_EXAMINER', { aipdStatut: 'NON_RETENUE', aipdJustification: '' })).toBe('JUSTIFICATION_REQUISE')
    expect(alerteAipd('A_EXAMINER', { aipdStatut: 'NON_RETENUE', aipdJustification: 'Risque faible : données pseudonymisées' })).toBeNull()
    expect(alerteAipd('NON', { aipdStatut: null, aipdJustification: '' })).toBeNull()
  })
})

describe('validerSuiviAipd', () => {
  it('« non retenue » exige une justification dès qu’un critère est présent (décision documentée)', () => {
    expect(validerSuiviAipd('REQUISE', { aipdStatut: 'NON_RETENUE', aipdJustification: '' })).toBe('justification_requise')
    expect(validerSuiviAipd('NON', { aipdStatut: 'NON_RETENUE', aipdJustification: '' })).toBeNull()
    expect(validerSuiviAipd('REQUISE', { aipdStatut: 'EN_COURS', aipdJustification: '' })).toBeNull()
  })
})
