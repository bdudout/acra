import { describe, it, expect } from 'vitest'
import {
  DEFAULT_TAXONOMIE_BALE, sanitizeTaxonomie, resolveTaxonomie, taxonomieLabel,
  type TaxonomieNode,
} from '@/lib/taxonomie'

describe('DEFAULT_TAXONOMIE_BALE', () => {
  it('contient les 7 catégories Bâle de risque opérationnel, ordonnées', () => {
    expect(DEFAULT_TAXONOMIE_BALE).toHaveLength(7)
    expect(DEFAULT_TAXONOMIE_BALE.map(n => n.code)).toEqual(['BALE_1', 'BALE_2', 'BALE_3', 'BALE_4', 'BALE_5', 'BALE_6', 'BALE_7'])
    expect(DEFAULT_TAXONOMIE_BALE.every(n => n.domaine === 'OP_RISK' && n.parent === null && n.labelKey)).toBe(true)
  })
})

describe('sanitizeTaxonomie', () => {
  it('non-tableau → []', () => {
    expect(sanitizeTaxonomie(null)).toEqual([])
    expect(sanitizeTaxonomie({})).toEqual([])
  })
  it('conserve les nœuds valides, rejette codes invalides/dupliqués et sans libellé', () => {
    const r = sanitizeTaxonomie([
      { code: 'A', label: 'Alpha', domaine: 'OP_RISK', ordre: 1 },
      { code: 'A', label: 'Doublon' },              // dupliqué → rejeté
      { code: 'bad code', label: 'X' },             // code invalide (espace) → rejeté
      { code: 'B' },                                // sans libellé → rejeté
      { code: 'C', labelKey: 'x.y', domaine: 'BIDON', ordre: 2 }, // domaine inconnu → OP_RISK
    ])
    expect(r.map(n => n.code)).toEqual(['A', 'C'])
    expect(r.find(n => n.code === 'C')?.domaine).toBe('OP_RISK')
  })
  it('trie par ordre et détache les parents orphelins', () => {
    const r = sanitizeTaxonomie([
      { code: 'CHILD', label: 'Enfant', ordre: 2, parent: 'ABSENT' },
      { code: 'ROOT', label: 'Racine', ordre: 1 },
    ])
    expect(r.map(n => n.code)).toEqual(['ROOT', 'CHILD'])
    expect(r.find(n => n.code === 'CHILD')?.parent).toBeNull() // parent inexistant → null
  })
  it('conserve un parent existant', () => {
    const r = sanitizeTaxonomie([
      { code: 'P', label: 'Parent', ordre: 1 },
      { code: 'S', label: 'Sous', ordre: 2, parent: 'P' },
    ])
    expect(r.find(n => n.code === 'S')?.parent).toBe('P')
  })
})

describe('resolveTaxonomie', () => {
  it('override vide → défaut Bâle', () => {
    expect(resolveTaxonomie([])).toBe(DEFAULT_TAXONOMIE_BALE)
    expect(resolveTaxonomie(null)).toBe(DEFAULT_TAXONOMIE_BALE)
  })
  it('override non vide → prime sur le défaut', () => {
    const r = resolveTaxonomie([{ code: 'X', label: 'Custom', ordre: 1 }])
    expect(r.map(n => n.code)).toEqual(['X'])
  })
})

describe('taxonomieLabel', () => {
  const tr = (k: string) => ({ 'taxonomie.bale.1': 'Fraude interne' }[k] ?? '')
  it('libellé personnalisé prime', () => {
    expect(taxonomieLabel({ code: 'BALE_1', label: 'Mon libellé', labelKey: 'taxonomie.bale.1', domaine: 'OP_RISK', ordre: 1 } as TaxonomieNode, tr)).toBe('Mon libellé')
  })
  it('sinon résolution i18n, repli sur le code', () => {
    expect(taxonomieLabel({ code: 'BALE_1', labelKey: 'taxonomie.bale.1', domaine: 'OP_RISK', ordre: 1 }, tr)).toBe('Fraude interne')
    expect(taxonomieLabel({ code: 'ZZZ', labelKey: 'inexistant', domaine: 'OP_RISK', ordre: 1 }, tr)).toBe('ZZZ')
  })
})
