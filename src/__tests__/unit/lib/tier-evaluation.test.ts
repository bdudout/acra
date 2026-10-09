// Évaluation d'un usage de service tiers (lot T1, docs/specs/evaluation-tiers-par-usage.md) — mêmes principes que
// l'atelier 3 d'EBIOS RM : 4 critères sur les échelles de l'organisation, menace = (dépendance × pénétration) /
// (maturité × confiance), zones veille / contrôle / danger ; cotation actuelle et cible ; évaluation par le propriétaire du
// risque ou l'analyste, validation par le RSSI ; synthèse au pire niveau ; réévaluation 12 mois après la validation.
import { describe, expect, it } from 'vitest'
import { ECHELLES_ECOSYSTEME_DEFAUT } from '@/lib/ecosystem-echelles'
import {
  coterEvaluation, peutEvaluerTiers, peutValiderEvaluationTiers, prochaineEvaluation, sanitizeEvaluationTiers, synthesePireNiveau, transitionEvaluationTiers,
} from '@/lib/tier-evaluation'

const E = ECHELLES_ECOSYSTEME_DEFAUT

describe('sanitizeEvaluationTiers', () => {
  it('critères bornés aux échelles de l’organisation, clauses connues, listes d’identifiants, justification bornée', () => {
    const s = sanitizeEvaluationTiers({
      actuelle: { dependance: 4, penetration: 9, maturite: 0, confiance: 'x' }, cible: { dependance: 4, penetration: 2, maturite: 3, confiance: 3 },
      clauses: ['securite', 'reversibilite', 'inconnue'], traitementIds: ['t1', 't1', 7], risqueIds: ['r1'], justification: ' Hébergement des données de paie ',
    }, E)
    expect(s.actuelle).toEqual({ dependance: 4, penetration: 4, maturite: 1, confiance: null })
    expect(s.cible).toEqual({ dependance: 4, penetration: 2, maturite: 3, confiance: 3 })
    expect(s.clauses).toEqual(['securite', 'reversibilite'])
    expect(s.traitementIds).toEqual(['t1'])
    expect(s.risqueIds).toEqual(['r1'])
    expect(s.justification).toBe('Hébergement des données de paie')
  })
})

describe('coterEvaluation — méthode EBIOS RM (atelier 3)', () => {
  it('menace = exposition / fiabilité et zone, pour l’actuelle et la cible ; incomplète → null', () => {
    const c = coterEvaluation({ actuelle: { dependance: 4, penetration: 3, maturite: 2, confiance: 2 }, cible: { dependance: 4, penetration: 2, maturite: 3, confiance: 3 } }, E)
    expect(c.actuelle).toEqual({ exposition: 12, fiabilite: 4, menace: 3, zone: 'danger' })
    expect(c.cible).toEqual({ exposition: 8, fiabilite: 9, menace: 8 / 9, zone: 'veille' })
    expect(coterEvaluation({ actuelle: { dependance: 4, penetration: null, maturite: 2, confiance: 2 }, cible: null }, E)).toEqual({ actuelle: null, cible: null })
  })
})

describe('cycle et droits', () => {
  it('évalue : propriétaire du risque / analyste (et gouvernance) ; valide : RSSI (administrateur en petite structure)', () => {
    for (const r of ['ANALYSTE', 'RISK_MANAGER', 'DIRECTION_METIER', 'RSSI', 'ADMIN'] as const) expect(peutEvaluerTiers(r), r).toBe(true)
    for (const r of ['LECTEUR', 'AUDITEUR', 'METIER'] as const) expect(peutEvaluerTiers(r), r).toBe(false)
    expect(peutValiderEvaluationTiers('RSSI', {})).toBe(true)
    expect(peutValiderEvaluationTiers('RISK_MANAGER', {})).toBe(false)
    expect(peutValiderEvaluationTiers('ADMIN', {})).toBe(false)
    expect(peutValiderEvaluationTiers('ADMIN', { petiteStructure: true })).toBe(true)
  })
  it('brouillon → soumise (cotation actuelle complète) → validée (RSSI) ; renvoi ; toute modification d’une validée la repasse en brouillon', () => {
    const complete = { actuelle: { dependance: 3, penetration: 3, maturite: 3, confiance: 3 }, cible: null }
    expect(transitionEvaluationTiers('BROUILLON', 'SOUMETTRE', { role: 'ANALYSTE', evaluation: { actuelle: { dependance: 3, penetration: null, maturite: 3, confiance: 3 }, cible: null } })).toEqual({ ok: false, error: 'cotation_incomplete' })
    expect(transitionEvaluationTiers('BROUILLON', 'SOUMETTRE', { role: 'ANALYSTE', evaluation: complete })).toEqual({ ok: true, statut: 'SOUMISE' })
    expect(transitionEvaluationTiers('SOUMISE', 'VALIDER', { role: 'ANALYSTE', evaluation: complete })).toEqual({ ok: false, error: 'role_validateur_requis' })
    expect(transitionEvaluationTiers('SOUMISE', 'VALIDER', { role: 'RSSI', evaluation: complete })).toEqual({ ok: true, statut: 'VALIDEE' })
    expect(transitionEvaluationTiers('SOUMISE', 'RENVOYER', { role: 'RSSI', evaluation: complete })).toEqual({ ok: true, statut: 'BROUILLON' })
    expect(transitionEvaluationTiers('BROUILLON', 'VALIDER', { role: 'RSSI', evaluation: complete })).toEqual({ ok: false, error: 'transition_interdite' })
    expect(transitionEvaluationTiers('VALIDEE', 'MODIFIER', { role: 'ANALYSTE', evaluation: complete })).toEqual({ ok: true, statut: 'BROUILLON' })
  })
  it('réévaluation 12 mois après la validation ; pas d’échéance tant que non validée', () => {
    expect(prochaineEvaluation(new Date('2026-03-31T00:00:00Z'))?.toISOString().slice(0, 10)).toBe('2027-03-31')
    expect(prochaineEvaluation(null)).toBeNull()
  })
})

describe('synthesePireNiveau', () => {
  it('pire menace (actuelle) parmi les usages évalués, jamais une moyenne ; aucun usage évalué → null', () => {
    expect(synthesePireNiveau([{ menace: 0.5, zone: 'veille' }, { menace: 3, zone: 'danger' }, null])).toEqual({ menace: 3, zone: 'danger', evalues: 2 })
    expect(synthesePireNiveau([null, null])).toBeNull()
  })
})
