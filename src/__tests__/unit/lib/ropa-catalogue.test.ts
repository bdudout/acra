import { describe, it, expect } from 'vitest'
import { listRopaTemplates, ROPA_PLACEHOLDER_KEY, ROPA_TEMPLATES } from '@/lib/ropa-catalogue'
import { champsManquantsArt30, sanitizeTraitement, BASES_LEGALES } from '@/lib/ropa'

const LOCALES = ['fr', 'en', 'de', 'es', 'it'] as const

describe('catalogue RoPA traduit (traitements types, socle CNIL simplifié)', () => {
  it('fournit les traitements habituels (≥ 10), clés stables uniques, noms uniques dans chaque langue', () => {
    expect(ROPA_TEMPLATES.length).toBeGreaterThanOrEqual(10)
    expect(new Set(ROPA_TEMPLATES.map(t => t.key)).size).toBe(ROPA_TEMPLATES.length)
    for (const locale of LOCALES) {
      const noms = listRopaTemplates(locale).map(t => t.nom)
      expect(new Set(noms).size, locale).toBe(noms.length)
      expect(noms.every(n => n.trim() !== ''), locale).toBe(true)
    }
  })
  it('les traitements standards ont une base légale valide et sont complets (art. 30) dans les 5 langues', () => {
    for (const locale of LOCALES) {
      for (const t of listRopaTemplates(locale).filter(t => t.key !== ROPA_PLACEHOLDER_KEY)) {
        expect((BASES_LEGALES as readonly string[]).includes(t.baseLegale), t.key).toBe(true)
        expect(champsManquantsArt30(sanitizeTraitement(t)), `${locale} ${t.key}`).toEqual([])
      }
    }
  })
  it('les listes traduites ont autant d’éléments que le français (pas de décalage)', () => {
    const fr = listRopaTemplates('fr')
    for (const locale of LOCALES) {
      listRopaTemplates(locale).forEach((t, i) => {
        expect(t.categoriesDonnees.length, `${locale} ${t.key}`).toBe(fr[i].categoriesDonnees.length)
        expect(t.destinataires.length, `${locale} ${t.key}`).toBe(fr[i].destinataires.length)
      })
    }
  })
  it('hors français, une durée de conservation est présentée comme une référence du droit français à vérifier', () => {
    for (const locale of ['en', 'de', 'es', 'it'] as const) {
      for (const t of listRopaTemplates(locale).filter(t => t.dureeConservation)) expect(t.dureeConservation, `${locale} ${t.key}`).toMatch(/French|französisch|francés|francese/)
    }
  })
  it('inclut un traitement « métier » placeholder à compléter (mis en avant comme incomplet)', () => {
    const ph = listRopaTemplates('fr').find(t => t.key === ROPA_PLACEHOLDER_KEY)!
    expect(champsManquantsArt30(sanitizeTraitement(ph)).length).toBeGreaterThan(0)
  })
})
