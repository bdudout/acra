/** Exemples et explications des modules récents : parité ×5 et cohérence des codes référencés. */
import { describe, expect, it } from 'vitest'
import { fr } from '@/lib/i18n/fr'
import { en } from '@/lib/i18n/en'
import { de } from '@/lib/i18n/de'
import { es } from '@/lib/i18n/es'
import { it as itLocale } from '@/lib/i18n/it'
import { TEST_RESILIENCE_TYPES } from '@/lib/tests-resilience'

const locales = { fr, en, de, es, it: itLocale } as Record<string, typeof fr>

describe('exemples et guides des modules récents', () => {
  it.each(Object.keys(locales))('%s : mêmes nombres d’exemples que le français, aucun texte vide', l => {
    const t = locales[l]
    expect(t.projets.examples).toHaveLength(fr.projets.examples.length)
    expect(t.derogations.examples).toHaveLength(fr.derogations.examples.length)
    expect(t.testsResilience.examples).toHaveLength(fr.testsResilience.examples.length)
    const texts = [
      ...t.projets.examples.flatMap(e => [e.nom, e.description]),
      ...t.derogations.examples.flatMap(e => [e.label, e.motif, e.mesures]),
      ...t.testsResilience.examples.flatMap(e => [e.intitule, e.perimetre]),
      ...[t.projets.guide, t.testsResilience.guide, t.appetence.guide, t.maturite.guide].flatMap(g => [g.what, g.how, g.result]),
      t.exemples.title, t.exemples.guideTitle, t.exemples.guideWhat, t.exemples.guideHow, t.exemples.guideResult,
    ]
    expect(texts.every(x => x.trim().length > 3)).toBe(true)
  })
  it('les tests d’exemple utilisent des types officiels et un testeur valide', () => {
    for (const e of fr.testsResilience.examples) {
      expect((TEST_RESILIENCE_TYPES as readonly string[]).includes(e.type)).toBe(true)
      expect(['INTERNE', 'EXTERNE']).toContain(e.testeur)
    }
  })
  it('les exemples traduits gardent les mêmes codes (type, testeur, fonction critique) que le français', () => {
    for (const [l, t] of Object.entries(locales)) {
      t.testsResilience.examples.forEach((e, i) => {
        const ref = fr.testsResilience.examples[i]
        expect([l, e.type, e.testeur, e.fonctionCritique]).toEqual([l, ref.type, ref.testeur, ref.fonctionCritique])
      })
    }
  })
})
