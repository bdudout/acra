import { describe, it, expect } from 'vitest'
import { normalizeTierName, consolidateTiers, type TierInput } from '@/lib/tiers'

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
