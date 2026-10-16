import { describe, it, expect } from 'vitest'
import { FRAMEWORK_IDS, FRAMEWORK_META, getFrameworkControles, getFrameworkCategories, recommendedFrameworksForSector } from '@/lib/frameworks-data'
import { referentielCodeFromNom } from '@/lib/referentiel-catalogue'
import en from '@/lib/i18n/ebios-data/en'
import de from '@/lib/i18n/ebios-data/de'
import es from '@/lib/i18n/ebios-data/es'
import it_ from '@/lib/i18n/ebios-data/it'
import fr from '@/lib/i18n/ebios-data/fr'

// Lot L9 — référentiel « Prestataires de services de confiance — règlement eIDAS »
// (règlement (UE) n° 910/2014 modifié par le règlement (UE) 2024/1183).

const LOCALES = ['en', 'de', 'es', 'it'] as const
const DICTS: Record<string, Record<string, string>> = { en, de, es, it: it_ }

describe('référentiel eIDAS (prestataires de services de confiance)', () => {
  it('est un cadre livré, avec ses métadonnées', () => {
    expect(FRAMEWORK_IDS).toContain('EIDAS')
    expect(FRAMEWORK_META.EIDAS.nom).toContain('eIDAS')
    expect(FRAMEWORK_META.EIDAS.version).toContain('2024/1183')
  })

  it('expose 23 points de contrôle aux références uniques, au format eIDAS-<article>…', () => {
    const ctrls = getFrameworkControles('EIDAS')
    expect(ctrls).toHaveLength(23)
    const refs = ctrls.map(c => c.ref)
    expect(new Set(refs).size).toBe(refs.length)
    for (const r of refs) expect(r).toMatch(/^eIDAS-(19a|20|21|24)\.[0-9a-z.]+$/)
    // Article 19 supprimé par l'art. 42 de la directive NIS2 : aucun point ne s'y rattache.
    expect(refs.some(r => r.startsWith('eIDAS-19.'))).toBe(false)
    // Points structurants
    for (const r of ['eIDAS-24.2.a', 'eIDAS-24.2.fa', 'eIDAS-24.2.g', 'eIDAS-24.2.i', 'eIDAS-24.3', 'eIDAS-20.1', 'eIDAS-21.1', 'eIDAS-19a.1.a'])
      expect(refs).toContain(r)
  })

  it('chaque point a une catégorie connue et cite son article', () => {
    const ctrls = getFrameworkControles('EIDAS')
    const cats = getFrameworkCategories('EIDAS')
    for (const c of ctrls) {
      expect(cats[c.categorie]).toBeTruthy()
      expect(c.description).toMatch(/art\. (19 bis|20|21|24)/)
    }
  })

  it('est proposé par défaut au sous-secteur numerique-confiance (en tête)', () => {
    const r = recommendedFrameworksForSector('Informatique / Numérique', null, 'numerique-confiance')
    expect(r[0]).toBe('EIDAS')
  })

  it("n'est pas proposé à un secteur sans rapport", () => {
    expect(recommendedFrameworksForSector('Santé / Médico-social')).not.toContain('EIDAS')
    expect(recommendedFrameworksForSector('Informatique / Numérique')).not.toContain('EIDAS')
    expect(recommendedFrameworksForSector('Informatique / Numérique', null, 'numerique-cloud')).not.toContain('EIDAS')
  })

  it('le nom « eIDAS » se résout vers le cadre livré', () => {
    expect(referentielCodeFromNom('eIDAS')).toBe('EIDAS')
  })

  it('parité i18n : chaque libellé FR est traduit dans les 4 autres langues', () => {
    const keys = Object.keys(fr).filter(k => k.startsWith('EIDAS_'))
    // 23 points × (nom + description) + 6 catégories
    expect(keys).toHaveLength(23 * 2 + 6)
    for (const lang of LOCALES) {
      for (const k of keys) {
        expect(DICTS[lang][k], `${lang} ${k}`).toBeTruthy()
        expect(DICTS[lang][k], `${lang} ${k} non traduit`).not.toBe(fr[k])
      }
    }
  })

  it('localise contrôles et catégories (mêmes refs)', () => {
    const frC = getFrameworkControles('EIDAS')
    for (const lang of LOCALES) {
      const l = getFrameworkControles('EIDAS', undefined, lang)
      expect(l.map(c => c.ref)).toEqual(frC.map(c => c.ref))
      expect(Object.keys(getFrameworkCategories('EIDAS', lang))).toEqual(Object.keys(getFrameworkCategories('EIDAS')))
    }
    expect(getFrameworkControles('EIDAS', undefined, 'en').find(c => c.ref === 'eIDAS-24.2.i')!.nom.toLowerCase()).toContain('termination plan')
  })
})
