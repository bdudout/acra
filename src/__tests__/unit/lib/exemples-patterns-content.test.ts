// Lot A3 — contenu des patterns : plancher de profondeur, intégrité des données, 5 langues, combinaisons (BE-5, BE-7).
import { describe, it, expect } from 'vitest'
import { PATTERN_ITEMS, localizePatternItem } from '@/lib/exemples-patterns'
import { ARCHI_PATTERNS, LOT1_CODES, isPatternCode } from '@/lib/patterns-archi'
import { TYPES_BIEN_SUPPORT, TYPES_ACTION_ELEMENTAIRE } from '@/lib/ebios-data'

const LOCALES = ['fr', 'en', 'de', 'es', 'it'] as const
const isTr = (v: unknown) => Array.isArray(v) && v.length === 5 && v.every(x => typeof x === 'string' && x.trim().length > 0)
const TEXT_KEYS = ['nom', 'description', 'motivation', 'ressources', 'mesure']
const FLOOR_ITEMS = 6, FLOOR_CATEGORIES = 4

describe('plancher de profondeur (patterns du lot 1)', () => {
  for (const code of LOT1_CODES) {
    it(`${code} : au moins ${FLOOR_ITEMS} éléments propres sur ${FLOOR_CATEGORIES} catégories`, () => {
      const own = PATTERN_ITEMS.filter(i => i.patterns.length === 1 && i.patterns[0] === code)
      expect(own.length, `${code}: ${own.length} éléments`).toBeGreaterThanOrEqual(FLOOR_ITEMS)
      expect(new Set(own.map(i => i.category)).size).toBeGreaterThanOrEqual(FLOOR_CATEGORIES)
    })
  }
})

describe('intégrité des données', () => {
  it('chaque élément référence des patterns connus, sans doublon', () => {
    for (const i of PATTERN_ITEMS) {
      expect(i.patterns.length).toBeGreaterThan(0)
      for (const p of i.patterns) expect(isPatternCode(p), p).toBe(true)
      expect(new Set(i.patterns).size).toBe(i.patterns.length)
    }
  })
  it('tous les textes sont des tuples de 5 chaînes non vides ; l’anglais diffère du français', () => {
    for (const i of PATTERN_ITEMS) for (const k of TEXT_KEYS) {
      const v = i.data[k]
      if (v === undefined) continue
      expect(isTr(v), `${i.patterns}/${i.category}/${k}`).toBe(true)
      expect((v as string[])[0] === (v as string[])[1] && (v as string[])[0].length > 25, `${i.patterns}/${k} non traduit`).toBe(false)
    }
  })
  it('énumérations et notes valides', () => {
    const bs = new Set(TYPES_BIEN_SUPPORT.map(t => t.value)), ae = new Set(TYPES_ACTION_ELEMENTAIRE.map(t => t.value))
    const in14 = (n: unknown) => typeof n === 'number' && n >= 1 && n <= 4
    for (const i of PATTERN_ITEMS) {
      const d = i.data
      if (i.category === 'biensSupports') expect(bs.has(d.type as never), `${d.nom}`).toBe(true)
      if (i.category === 'actionsElementaires') expect(ae.has(d.type as never)).toBe(true)
      if (i.category === 'evenementsRedoutes') { expect(in14(d.graviteDefaut)).toBe(true); expect(Array.isArray(d.impacts) && (d.impacts as unknown[]).every(isTr)).toBe(true) }
      if (i.category === 'scenariosStrategiques') { expect(['C', 'I', 'D', 'T']).toContain(d.critere); expect(in14(d.vraisemblanceDefaut)).toBe(true); expect(in14(d.graviteDefaut)).toBe(true) }
      if (i.category === 'sourcesRisque') expect(in14(d.pertinenceDefaut)).toBe(true)
      if (i.category === 'mesures') { expect(in14(d.prioriteDefaut)).toBe(true); expect(['GOUVERNANCE', 'PROTECTION', 'DEFENSE', 'RESILIENCE']).toContain(d.categorieEbios) }
      if (i.category === 'valeursMetier') for (const k of ['disponibilite', 'integrite', 'confidentialite', 'tracabilite']) expect(in14(d[k])).toBe(true)
    }
  })
  it('localisation : chaque élément se localise dans les 5 langues, sans tuple résiduel', () => {
    for (const i of PATTERN_ITEMS) for (const l of LOCALES) {
      const out = localizePatternItem(i, l)
      for (const v of Object.values(out)) expect(Array.isArray(v) && v.length === 5 && v.every(x => typeof x === 'string')).toBe(false)
    }
  })
  it('noms uniques par catégorie et par jeu de patterns (pas de doublon dans le contenu)', () => {
    const seen = new Set<string>()
    for (const i of PATTERN_ITEMS) {
      const nom = (i.data.nom ?? i.data.mesure ?? i.data.description) as readonly string[]
      const k = `${i.patterns.join('+')}|${i.category}|${nom[0]}`
      expect(seen.has(k), k).toBe(false); seen.add(k)
    }
  })
})

describe('combinaisons (BE-5)', () => {
  const combos = PATTERN_ITEMS.filter(i => i.patterns.length > 1)
  it('les trois exemples de la spec existent', () => {
    const has = (a: string, b: string) => combos.some(i => i.patterns.includes(a) && i.patterns.includes(b))
    expect(has('EXPOSITION_INTERNET', 'SI_SENSIBLE')).toBe(true)
    expect(has('TELEMAINTENANCE', 'SI_INDUSTRIEL')).toBe(true)
    expect(has('SI_TPE', 'EXTERNALISATION_DONNEES')).toBe(true)
  })
})

describe('le secteur « Technique / Interconnexion de SI » est devenu des patterns (BE-10)', () => {
  it('le contenu d’interconnexion est repris par INTERCO_TIERS, EXTERNALISATION_DONNEES, API_PARTENAIRES, ECHANGE_FICHIERS', () => {
    for (const code of ['INTERCO_TIERS', 'EXTERNALISATION_DONNEES', 'API_PARTENAIRES', 'ECHANGE_FICHIERS']) {
      expect(PATTERN_ITEMS.filter(i => i.patterns[0] === code && i.patterns.length === 1).length, code).toBeGreaterThanOrEqual(10)
    }
  })
  it('chaque pattern du référentiel a une famille valide', () => expect(ARCHI_PATTERNS.every(p => p.family)).toBe(true))
})
