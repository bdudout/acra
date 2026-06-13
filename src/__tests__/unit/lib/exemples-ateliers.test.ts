import { describe, it, expect } from 'vitest'
import {
  EXEMPLES_CATEGORIES,
  getCategoryDef,
  sanitizeExemples,
  resolveExemples,
  type ExempleCategoryKey,
} from '@/lib/exemples-ateliers'

describe('exemples-ateliers — registre', () => {
  it('expose au moins les 3 catégories de l’Atelier 1', () => {
    const keys = EXEMPLES_CATEGORIES.map((c) => c.key)
    expect(keys).toContain('valeursMetier')
    expect(keys).toContain('biensSupports')
    expect(keys).toContain('evenementsRedoutes')
  })

  it('chaque catégorie a une clé unique, un atelier et au moins un champ', () => {
    const seen = new Set<string>()
    for (const c of EXEMPLES_CATEGORIES) {
      expect(seen.has(c.key)).toBe(false)
      seen.add(c.key)
      expect(c.atelier).toBeGreaterThanOrEqual(1)
      expect(c.fields.length).toBeGreaterThan(0)
      // le champ "primary" doit exister dans les champs
      expect(c.fields.some((f) => f.key === c.primary)).toBe(true)
    }
  })

  it('getCategoryDef renvoie la def ou undefined', () => {
    expect(getCategoryDef('valeursMetier')?.atelier).toBe(1)
    expect(getCategoryDef('inconnue' as ExempleCategoryKey)).toBeUndefined()
  })
})

describe('sanitizeExemples — valeurs métier', () => {
  it('nettoie les textes, borne les scores [1..5] et coerce le type enum', () => {
    const out = sanitizeExemples('valeursMetier', [
      {
        nom: '  Paie  ', type: 'INFORMATION', description: 'desc',
        disponibilite: 9, integrite: 0, confidentialite: 3, tracabilite: 'x',
      },
      { nom: 'Bad type', type: 'NIMPORTE', disponibilite: 2, integrite: 2, confidentialite: 2, tracabilite: 2 },
    ])
    expect(out[0].nom).toBe('Paie')
    expect(out[0].disponibilite).toBe(5) // 9 borné à 5
    expect(out[0].integrite).toBe(1)     // 0 borné à 1
    expect(typeof out[0].tracabilite).toBe('number') // 'x' -> nombre par défaut
    // type invalide -> coerce vers une valeur autorisée
    expect(['PROCESSUS', 'INFORMATION']).toContain(out[1].type)
  })

  it('supprime les lignes dont le champ primary (nom) est vide', () => {
    const out = sanitizeExemples('valeursMetier', [
      { nom: '   ', type: 'PROCESSUS' },
      { nom: 'Valide', type: 'PROCESSUS' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].nom).toBe('Valide')
  })
})

describe('sanitizeExemples — événements redoutés (liste de chaînes)', () => {
  it('nettoie impacts (filtre vides, trim) et borne graviteDefaut', () => {
    const out = sanitizeExemples('evenementsRedoutes', [
      { description: 'Fuite', impacts: ['  RGPD  ', '', '   ', 'Réputation'], graviteDefaut: 99 },
    ])
    expect(out[0].impacts).toEqual(['RGPD', 'Réputation'])
    expect(out[0].graviteDefaut).toBe(5)
  })

  it('supprime les lignes sans description (primary)', () => {
    const out = sanitizeExemples('evenementsRedoutes', [
      { description: '', impacts: ['x'] },
      { description: 'OK', impacts: [] },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].description).toBe('OK')
  })
})

describe('sanitizeExemples — robustesse', () => {
  it('catégorie inconnue -> tableau vide', () => {
    expect(sanitizeExemples('inconnue' as ExempleCategoryKey, [{ a: 1 }])).toEqual([])
  })
  it('entrée non-tableau -> tableau vide', () => {
    expect(sanitizeExemples('valeursMetier', null as unknown as unknown[])).toEqual([])
  })
})

describe('resolveExemples — repli sur les défauts', () => {
  const defaults = [{ nom: 'Défaut' }]
  it('retourne l’override quand il est un tableau non vide', () => {
    expect(resolveExemples([{ nom: 'Custom' }], defaults)).toEqual([{ nom: 'Custom' }])
  })
  it('retombe sur les défauts si override absent ou vide', () => {
    expect(resolveExemples(undefined, defaults)).toBe(defaults)
    expect(resolveExemples([], defaults)).toBe(defaults)
    expect(resolveExemples(null, defaults)).toBe(defaults)
  })
})
