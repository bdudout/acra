/** Projet 360 — volet continuité informatique (PCA/PRA, sauvegardes, RTO/RPO du SI vs tolérance d'impact). */
import { describe, expect, it } from 'vitest'
import { QUESTIONS_360, RISK_RULES_360, defaultAnswers360, suggested360Risks, synthetiserContinuite360, type Faits360 } from '@/lib/projet360'

const now = new Date('2026-11-03T10:00:00Z')
const base: Faits360 = { analysesCyber: 0, ticCritiques: 0, ticCloud: 0, processusCritiques: 0, traitementsRgpd: 0, doraActif: false }
const ids = ['p360.it.pcaPra', 'p360.it.sauvegardesTestees', 'p360.it.rtoRpoDefinis', 'p360.it.rtoCompatibleTolerance']

describe('questions et règles de continuité IT', () => {
  it('quatre questions rattachées au domaine IT existant', () => {
    for (const id of ids) expect(QUESTIONS_360.find(q => q.id === id)?.domaine).toBe('IT')
  })
  it('une réponse « non » génère le risque de continuité correspondant (domaine IT)', () => {
    const keys = ['absencePra', 'sauvegardesNonTestees', 'rtoRpoNonDefinis', 'rtoAuDelaTolerance']
    ids.forEach((id, i) => {
      const r = suggested360Risks({ [id]: false })
      expect(r.map(x => x.titleKey)).toContain(`p360_${keys[i]}`)
      expect(r.every(x => x.category === 'IT')).toBe(true)
      expect(suggested360Risks({ [id]: true })).toEqual([])
    })
    expect(RISK_RULES_360.filter(r => ids.includes(r.when.questionId)).every(r => r.when.equals === false)).toBe(true)
  })
})

describe('synthetiserContinuite360', () => {
  it('compte objectifs définis, écarts RTO > tolérance et test récent', () => {
    const f = synthetiserContinuite360([
      { rtoMinutes: 60, rpoMinutes: 15, toleranceImpactMinutes: 120 },
      { rtoMinutes: 240, rpoMinutes: 30, toleranceImpactMinutes: 120 },
      { rtoMinutes: null, rpoMinutes: null, toleranceImpactMinutes: null },
    ], [{ statut: 'REALISE', dateRealisation: new Date('2026-03-01') }, { statut: 'PLANIFIE', dateRealisation: null }], now)
    expect(f).toEqual({ critiques: 3, objectifsDefinis: 2, comparables: 2, ecartsTolerance: 1, testRecent: true })
  })
  it('test ancien de plus de 12 mois ou non réalisé : pas de test récent', () => {
    expect(synthetiserContinuite360([], [{ statut: 'REALISE', dateRealisation: new Date('2025-01-01') }], now).testRecent).toBe(false)
    expect(synthetiserContinuite360([], [{ statut: 'ANNULE', dateRealisation: new Date('2026-10-01') }], now).testRecent).toBe(false)
  })
})

describe('pré-remplissage continuité', () => {
  it('rien sans donnée', () => {
    expect(defaultAnswers360(base).answers).toEqual({})
    expect(defaultAnswers360({ ...base, continuite: { critiques: 0, objectifsDefinis: 0, comparables: 0, ecartsTolerance: 0, testRecent: false } }).answers).toEqual({})
  })
  it('objectifs complets et compatibles → oui ; test récent → PCA/PRA oui', () => {
    const { answers, sources } = defaultAnswers360({ ...base, continuite: { critiques: 2, objectifsDefinis: 2, comparables: 2, ecartsTolerance: 0, testRecent: true } })
    expect(answers).toMatchObject({ 'p360.it.rtoRpoDefinis': true, 'p360.it.rtoCompatibleTolerance': true, 'p360.it.pcaPra': true })
    expect(sources['p360.it.rtoRpoDefinis']).toBe('continuite')
  })
  it('écart avéré RTO > tolérance → « non » (preuve dans les données)', () => {
    const { answers } = defaultAnswers360({ ...base, continuite: { critiques: 2, objectifsDefinis: 1, comparables: 1, ecartsTolerance: 1, testRecent: false } })
    expect(answers['p360.it.rtoCompatibleTolerance']).toBe(false)
    expect(answers['p360.it.rtoRpoDefinis']).toBeUndefined()
  })
})
