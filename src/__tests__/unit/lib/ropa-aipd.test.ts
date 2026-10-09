// Suivi de l'AIPD d'un traitement (RGPD art. 35-36) : statut, rattachement à une analyse, justification d'une AIPD non
// retenue (décision documentée), consultation préalable de l'autorité de contrôle.
import { describe, it, expect } from 'vitest'
import { sanitizeSuiviAipd, alerteAipd, validerSuiviAipd, aipdARelancer, STATUTS_AIPD } from '@/lib/ropa-aipd'
import { RELANCES_DEFAUT } from '@/lib/relances'

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

// Relance par e-mail (cron `relances`) : AIPD requise (≥ 2 critères WP248) mais pas engagée — au DPO, après le délai
// d'attente puis selon la périodicité de l'organisation ; rien si l'AIPD est en cours, réalisée ou écartée.
describe('aipdARelancer', () => {
  const cfg = { ...RELANCES_DEFAUT }
  const J = 86_400_000
  const now = new Date('2026-10-09T08:00:00Z')
  const il = (jours: number) => new Date(now.getTime() - jours * J)
  it('AIPD requise, non engagée, depuis plus que le délai d’attente : relance', () => {
    expect(aipdARelancer({ niveau: 'REQUISE', aipdStatut: null, depuis: il(10), rappelLe: null }, cfg, now)).toBe(true)
    expect(aipdARelancer({ niveau: 'REQUISE', aipdStatut: 'A_REALISER', depuis: il(10), rappelLe: null }, cfg, now)).toBe(true)
  })
  it('trop récent, ou déjà relancé dans la période : pas de relance', () => {
    expect(aipdARelancer({ niveau: 'REQUISE', aipdStatut: null, depuis: il(2), rappelLe: null }, cfg, now)).toBe(false)
    expect(aipdARelancer({ niveau: 'REQUISE', aipdStatut: null, depuis: il(60), rappelLe: il(5) }, cfg, now)).toBe(false)
    expect(aipdARelancer({ niveau: 'REQUISE', aipdStatut: null, depuis: il(60), rappelLe: il(31) }, cfg, now)).toBe(true)
  })
  it('AIPD engagée, réalisée ou écartée, ou critère unique (à examiner) : pas de relance', () => {
    for (const s of ['EN_COURS', 'REALISEE', 'NON_RETENUE'] as const) expect(aipdARelancer({ niveau: 'REQUISE', aipdStatut: s, depuis: il(60), rappelLe: null }, cfg, now)).toBe(false)
    expect(aipdARelancer({ niveau: 'A_EXAMINER', aipdStatut: null, depuis: il(60), rappelLe: null }, cfg, now)).toBe(false)
  })
  it('relances désactivées dans l’organisation : rien', () => {
    expect(aipdARelancer({ niveau: 'REQUISE', aipdStatut: null, depuis: il(60), rappelLe: null }, { ...cfg, actives: false }, now)).toBe(false)
  })
})
