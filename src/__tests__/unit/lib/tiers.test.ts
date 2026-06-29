import { describe, it, expect } from 'vitest'
import { normalizeTierName, consolidateTiers, suggestTierDuplicates, type TierInput } from '@/lib/tiers'

// Consolidation des tiers à travers les analyses (GitHub backlog #46, étape 1).

const row = (o: Partial<TierInput> & { nom: string; analyseId: string; menace: number }): TierInput => ({
  type: 'PRESTATAIRE', analyseNom: 'A', exposition: 4, fiabilite: 9, zone: 'veille', ...o,
})

describe('normalizeTierName', () => {
  it('minuscule, sans accents, espaces compactés', () => {
    expect(normalizeTierName('  Micro soft '.replace(' ', ' '))).toBe('micro soft')
    expect(normalizeTierName('Hébergeur   HDS')).toBe('hebergeur hds')
    expect(normalizeTierName('OVHcloud')).toBe('ovhcloud')
  })
})

describe('consolidateTiers', () => {
  it('regroupe par nom normalisé (« Microsoft » = « microsoft »)', () => {
    const r = consolidateTiers([
      row({ nom: 'Microsoft', analyseId: 'a1', menace: 1 }),
      row({ nom: 'microsoft', analyseId: 'a2', menace: 2 }),
    ])
    expect(r).toHaveLength(1)
    expect(r[0].occurrences).toBe(2)
    expect(r[0].analyses.map(a => a.analyseId).sort()).toEqual(['a1', 'a2'])
  })

  it('remonte le pire cas : menace max, fiabilité min, exposition max, zone du pire', () => {
    const r = consolidateTiers([
      row({ nom: 'X', analyseId: 'a1', menace: 0.5, exposition: 4, fiabilite: 12, zone: 'veille' }),
      row({ nom: 'X', analyseId: 'a2', menace: 3.0, exposition: 12, fiabilite: 3, zone: 'danger' }),
    ])
    expect(r[0].menace).toBe(3.0)
    expect(r[0].zone).toBe('danger')
    expect(r[0].exposition).toBe(12)
    expect(r[0].fiabilite).toBe(3)
  })

  it('critique = vrai si au moins une occurrence est critique', () => {
    const r = consolidateTiers([
      row({ nom: 'X', analyseId: 'a1', menace: 1, critique: false }),
      row({ nom: 'X', analyseId: 'a2', menace: 1, critique: true }),
    ])
    expect(r[0].critique).toBe(true)
  })

  it('déduplique les analyses et trie par menace décroissante', () => {
    const r = consolidateTiers([
      row({ nom: 'Faible', analyseId: 'a1', menace: 0.5 }),
      row({ nom: 'Fort', analyseId: 'a2', menace: 4 }),
      row({ nom: 'Fort', analyseId: 'a2', menace: 2 }), // même analyse → dédupliquée
    ])
    expect(r.map(t => t.nom)).toEqual(['Fort', 'Faible'])
    expect(r[0].analyses).toHaveLength(1)
    expect(r[0].occurrences).toBe(2)
  })

  it('ignore les noms vides', () => {
    expect(consolidateTiers([row({ nom: '  ', analyseId: 'a1', menace: 1 })])).toEqual([])
  })
})

describe('suggestTierDuplicates — détection de doublons potentiels (lecture seule)', () => {
  it('regroupe les tiers au premier token significatif partagé', () => {
    const tiers = consolidateTiers([
      row({ nom: 'Microsoft', analyseId: 'a1', menace: 2 }),
      row({ nom: 'Microsoft Azure', analyseId: 'a2', menace: 3 }),
      row({ nom: 'Microsoft 365', analyseId: 'a3', menace: 1 }),
      row({ nom: 'OVHcloud', analyseId: 'a4', menace: 1 }),
    ])
    const groups = suggestTierDuplicates(tiers)
    expect(groups).toHaveLength(1)
    expect(groups[0].map(t => t.key).sort()).toEqual(['microsoft', 'microsoft 365', 'microsoft azure'])
  })
  it('ignore les suffixes corporate (Cloud, Group…) pour le rapprochement', () => {
    const tiers = consolidateTiers([
      row({ nom: 'Cloud Provider A', analyseId: 'a1', menace: 1 }),
      row({ nom: 'Cloud Solutions B', analyseId: 'a2', menace: 1 }),
    ])
    // « cloud » est un mot vide → pas de faux regroupement sur ce seul mot
    expect(suggestTierDuplicates(tiers)).toEqual([])
  })
  it('aucun doublon → []', () => {
    const tiers = consolidateTiers([
      row({ nom: 'Alpha', analyseId: 'a1', menace: 1 }),
      row({ nom: 'Beta', analyseId: 'a2', menace: 1 }),
    ])
    expect(suggestTierDuplicates(tiers)).toEqual([])
  })
})
