import { describe, it, expect } from 'vitest'
import {
  QUESTIONNAIRE_TIC,
  REPONSES_TIC,
  cleanReponses,
  evaluerQuestionnaire,
} from '@/lib/tic-questionnaire'

describe('QUESTIONNAIRE_TIC', () => {
  it('propose un socle de due diligence sécurité/risque (≥ 8 questions, ids uniques)', () => {
    expect(QUESTIONNAIRE_TIC.length).toBeGreaterThanOrEqual(8)
    expect(new Set(QUESTIONNAIRE_TIC.map(q => q.id)).size).toBe(QUESTIONNAIRE_TIC.length)
  })
})

describe('cleanReponses', () => {
  it('ne garde que les ids connus et les réponses valides', () => {
    const r = cleanReponses([
      { id: 'iso27001', reponse: 'OUI' },
      { id: 'inconnu', reponse: 'OUI' },
      { id: 'chiffrement', reponse: 'BOGUS' },
      { id: 'droit_audit', reponse: 'NON', commentaire: 'à négocier' },
    ])
    expect(r.map(x => x.id).sort()).toEqual(['droit_audit', 'iso27001'])
    expect(r.find(x => x.id === 'droit_audit')?.commentaire).toBe('à négocier')
  })
  it('déduplique par id (dernière réponse gagne)', () => {
    const r = cleanReponses([{ id: 'iso27001', reponse: 'NON' }, { id: 'iso27001', reponse: 'OUI' }])
    expect(r).toHaveLength(1)
    expect(r[0].reponse).toBe('OUI')
  })
  it('accepte toutes les réponses de REPONSES_TIC', () => {
    for (const rep of REPONSES_TIC) {
      expect(cleanReponses([{ id: 'iso27001', reponse: rep }])).toHaveLength(1)
    }
  })
})

describe('evaluerQuestionnaire', () => {
  it('score sur les questions pertinentes (hors NA), liste les écarts (NON), complétude', () => {
    const v = evaluerQuestionnaire([
      { id: 'iso27001', reponse: 'OUI' },
      { id: 'chiffrement', reponse: 'PARTIEL' },
      { id: 'droit_audit', reponse: 'NON' },
      { id: 'localisation_donnees', reponse: 'NA' },
    ])
    expect(v.total).toBe(QUESTIONNAIRE_TIC.length)
    expect(v.repondu).toBe(4)
    expect(v.pertinents).toBe(3) // NA exclu
    expect(v.conformes).toBe(1)
    expect(v.ecarts).toContain('droit_audit')
    // score = (1 OUI + 0.5 PARTIEL) / 3 pertinents = 50 %
    expect(v.score).toBe(50)
    expect(v.complet).toBe(false)
  })
  it('vide → score 0, non complet, aucun écart', () => {
    const v = evaluerQuestionnaire([])
    expect(v.repondu).toBe(0)
    expect(v.score).toBe(0)
    expect(v.ecarts).toEqual([])
    expect(v.complet).toBe(false)
  })
  it('toutes les questions répondues → complet', () => {
    const v = evaluerQuestionnaire(QUESTIONNAIRE_TIC.map(q => ({ id: q.id, reponse: 'OUI' as const })))
    expect(v.complet).toBe(true)
    expect(v.score).toBe(100)
  })
})
