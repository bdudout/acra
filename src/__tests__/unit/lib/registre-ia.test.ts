import { describe, expect, it } from 'vitest'
import { classeIndicative, champsManquantsIa, revueEnRetard, sanitizeSystemeIa, USAGES_IA } from '@/lib/registre-ia'

describe('classeIndicative — règlement (UE) 2024/1689, toujours indicative', () => {
  it('usages relevant a priori de l’annexe III : haut risque probable, même en aide à la décision', () => {
    for (const u of ['ELIGIBILITE_PRESTATIONS', 'RECRUTEMENT', 'NOTATION_CREDIT', 'BIOMETRIE'] as const) {
      expect(classeIndicative(u, 'AIDE')).toBe('HAUT_RISQUE_PROBABLE')
    }
  })
  it('agent conversationnel et IA générative en aide : obligations de transparence (art. 50)', () => {
    expect(classeIndicative('IA_GENERATIVE', 'AIDE')).toBe('RISQUE_LIMITE')
    expect(classeIndicative('ORIENTATION_USAGERS', 'AIDE')).toBe('RISQUE_LIMITE')
  })
  it('décision automatisée ou usage non caractéristique : à qualifier', () => {
    expect(classeIndicative('IA_GENERATIVE', 'AUTOMATISEE')).toBe('A_QUALIFIER')
    expect(classeIndicative('DETECTION_FRAUDE', 'AIDE')).toBe('A_QUALIFIER')
    expect(classeIndicative('TRI_DOCUMENTS', 'AIDE')).toBe('A_QUALIFIER')
    expect(classeIndicative('AUTRE', 'AIDE')).toBe('A_QUALIFIER')
  })
})

describe('revueEnRetard — revue des biais et de la dérive tous les 12 mois', () => {
  const now = new Date('2026-10-08T12:00:00Z')
  it('jamais revue ou revue de plus de 12 mois : en retard ; récente : à jour', () => {
    expect(revueEnRetard(null, now)).toBe(true)
    expect(revueEnRetard(new Date('2025-10-01'), now)).toBe(true)
    expect(revueEnRetard(new Date('2026-03-01'), now)).toBe(false)
  })
  it('système retiré : jamais en retard', () => {
    expect(revueEnRetard(null, now, 'RETIRE')).toBe(false)
  })
})

describe('sanitizeSystemeIa', () => {
  it('valeurs bornées, listes nettoyées, codes inconnus ramenés aux défauts', () => {
    const s = sanitizeSystemeIa({ nom: '  Tri des CV  ', usage: 'XXX', typeDecision: 'AUTOMATISEE', statut: 'BIDON', donnees: ['CV', '', 3, 'CV'], categoriesParticulieres: 'oui', derniereRevue: '2026-01-15', analyseId: 12 })
    expect(s).toMatchObject({ nom: 'Tri des CV', usage: 'AUTRE', typeDecision: 'AUTOMATISEE', statut: 'EN_PROJET', donnees: ['CV'], categoriesParticulieres: false, analyseId: null })
    expect(s.derniereRevue?.toISOString().slice(0, 10)).toBe('2026-01-15')
    expect(USAGES_IA).toContain('RECRUTEMENT')
  })
})

describe('champsManquantsIa — fiche à compléter', () => {
  it('fournisseur, données, intervention humaine et contrôles attendus', () => {
    expect(champsManquantsIa(sanitizeSystemeIa({ nom: 'X', finalite: 'Y' }))).toEqual(['fournisseur', 'donnees', 'interventionHumaine', 'controlesBiais'])
    expect(champsManquantsIa(sanitizeSystemeIa({ nom: 'X', finalite: 'Y', fournisseur: 'Z', donnees: ['a'], interventionHumaine: 'h', controlesBiais: 'c' }))).toEqual([])
  })
})
