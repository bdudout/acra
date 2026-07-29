import { describe, it, expect } from 'vitest'
import {
  validateRiskActionInput, cleanRiskActionInput, effectiveStatut, summarizeActions, RISK_ACTION_STATUTS,
} from '@/lib/risk-action'

describe('validateRiskActionInput', () => {
  it('intitulé requis', () => {
    expect(validateRiskActionInput({ intitule: '  ' })).toBe('intitule_requis')
    expect(validateRiskActionInput({ intitule: 'Chiffrer les sauvegardes' })).toBeNull()
  })
  it('échéance invalide', () => {
    expect(validateRiskActionInput({ intitule: 'X', echeance: 'pas-une-date' })).toBe('echeance_invalide')
    expect(validateRiskActionInput({ intitule: 'X', echeance: '2026-09-01' })).toBeNull()
    expect(validateRiskActionInput({ intitule: 'X', echeance: null })).toBeNull()
  })
  it('statut invalide', () => {
    expect(validateRiskActionInput({ intitule: 'X', statut: 'BOGUS' })).toBe('statut_invalide')
    expect(validateRiskActionInput({ intitule: 'X', statut: 'EN_COURS' })).toBeNull()
  })
})

describe('cleanRiskActionInput', () => {
  it('normalise et applique le défaut de statut', () => {
    const c = cleanRiskActionInput({ intitule: '  Patch serveurs  ', description: '  ', responsable: 'DSI', echeance: '2026-09-01', statut: 'BOGUS' })
    expect(c.intitule).toBe('Patch serveurs')
    expect(c.description).toBeNull()
    expect(c.responsable).toBe('DSI')
    expect(c.echeance instanceof Date).toBe(true)
    expect(c.statut).toBe('A_FAIRE')
  })
  it('échéance vide → null', () => {
    expect(cleanRiskActionInput({ intitule: 'X', echeance: '' }).echeance).toBeNull()
  })
})

describe('effectiveStatut', () => {
  const now = new Date('2026-07-29T12:00:00Z')
  it('FAIT reste FAIT même en retard', () => {
    expect(effectiveStatut({ statut: 'FAIT', echeance: '2020-01-01' }, now)).toBe('FAIT')
  })
  it('échéance dépassée et non FAITe → EN_RETARD', () => {
    expect(effectiveStatut({ statut: 'EN_COURS', echeance: '2026-07-01' }, now)).toBe('EN_RETARD')
    expect(effectiveStatut({ statut: 'A_FAIRE', echeance: '2026-07-01' }, now)).toBe('EN_RETARD')
  })
  it('échéance future ou absente → statut nominal', () => {
    expect(effectiveStatut({ statut: 'EN_COURS', echeance: '2026-12-31' }, now)).toBe('EN_COURS')
    expect(effectiveStatut({ statut: 'A_FAIRE', echeance: null }, now)).toBe('A_FAIRE')
  })
})

describe('summarizeActions', () => {
  const now = new Date('2026-07-29T12:00:00Z')
  it('compte par statut effectif et calcule le taux d\'avancement', () => {
    const s = summarizeActions([
      { statut: 'FAIT', echeance: '2020-01-01' },       // fait
      { statut: 'FAIT', echeance: null },               // fait
      { statut: 'EN_COURS', echeance: '2026-12-31' },   // en cours
      { statut: 'A_FAIRE', echeance: '2026-07-01' },    // en retard
      { statut: 'A_FAIRE', echeance: null },            // à faire
    ], now)
    expect(s).toEqual({ total: 5, faits: 2, enCours: 1, aFaire: 1, enRetard: 1, tauxAvancement: 40 })
  })
  it('aucune action → taux 0', () => {
    expect(summarizeActions([], now).tauxAvancement).toBe(0)
  })
})

describe('RISK_ACTION_STATUTS', () => {
  it('trois statuts stockés', () => {
    expect([...RISK_ACTION_STATUTS]).toEqual(['A_FAIRE', 'EN_COURS', 'FAIT'])
  })
})
