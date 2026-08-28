import { describe, it, expect } from 'vitest'
import {
  validateRiskActionInput, cleanRiskActionInput, effectiveStatut, summarizeActions, RISK_ACTION_STATUTS,
  cleanPriorite, cleanActionDelais, defaultEcheanceForPriorite, DEFAULT_ACTION_DELAIS_MOIS,
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

describe('priorité & échéance par défaut', () => {
  it('cleanPriorite : défaut MAJEUR', () => {
    expect(cleanPriorite('CRITIQUE')).toBe('CRITIQUE')
    expect(cleanPriorite('inconnu')).toBe('MAJEUR')
    expect(cleanPriorite(undefined)).toBe('MAJEUR')
  })
  it('DEFAULT : critique 6 mois, majeur 12, modéré 24', () => {
    expect(DEFAULT_ACTION_DELAIS_MOIS).toEqual({ CRITIQUE: 6, MAJEUR: 12, MODERE: 24 })
  })
  it('cleanActionDelais : entiers 1..600, défauts par clé', () => {
    expect(cleanActionDelais({ CRITIQUE: 3, MAJEUR: 0, MODERE: 999 })).toEqual({ CRITIQUE: 3, MAJEUR: 12, MODERE: 24 })
    expect(cleanActionDelais(null)).toEqual({ CRITIQUE: 6, MAJEUR: 12, MODERE: 24 })
  })
  it('defaultEcheanceForPriorite : date de départ + N mois (YYYY-MM-DD)', () => {
    const from = new Date('2026-01-15T00:00:00')
    expect(defaultEcheanceForPriorite('CRITIQUE', DEFAULT_ACTION_DELAIS_MOIS, from)).toBe('2026-07-15')
    expect(defaultEcheanceForPriorite('MAJEUR', DEFAULT_ACTION_DELAIS_MOIS, from)).toBe('2027-01-15')
    expect(defaultEcheanceForPriorite('MODERE', DEFAULT_ACTION_DELAIS_MOIS, from)).toBe('2028-01-15')
  })
  it('borne le jour en fin de mois (31 janv + 1 mois → 28 févr)', () => {
    const from = new Date('2026-01-31T00:00:00')
    expect(defaultEcheanceForPriorite('CRITIQUE', { CRITIQUE: 1, MAJEUR: 12, MODERE: 24 }, from)).toBe('2026-02-28')
  })
  it('cleanRiskActionInput porte la priorité', () => {
    expect(cleanRiskActionInput({ intitule: 'x', priorite: 'CRITIQUE' }).priorite).toBe('CRITIQUE')
    expect(cleanRiskActionInput({ intitule: 'x' }).priorite).toBe('MAJEUR')
  })
})
