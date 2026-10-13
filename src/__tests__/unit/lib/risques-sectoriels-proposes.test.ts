// Pack postal, lot L4.1 : après les risques de la qualification, jusqu'à 5 suggestions sectorielles (même classement que
// la phase 2), décochées par défaut, sans doublon d'intitulé avec les risques de qualification ou déjà présents.
import { describe, expect, it } from 'vitest'
import { risquesSectorielsProposes } from '@/lib/risques-sectoriels-proposes'

const POSTAL = 'Services postaux et d’expédition'

describe('risquesSectorielsProposes', () => {
  it('au plus 5 suggestions pertinentes, décochées, non imposées, avec cotation suggérée', () => {
    const r = risquesSectorielsProposes({ secteur: POSTAL, sousSecteurs: ['postal-colis'], locale: 'fr', exclus: [] })
    expect(r.length).toBeGreaterThan(0)
    expect(r.length).toBeLessThanOrEqual(5)
    for (const p of r) {
      expect(p).toMatchObject({ mandatory: false, preselected: false, category: 'CYBER', strategy: 'REDUIRE' })
      expect(p.id.startsWith('secteur:')).toBe(true)
      expect(p.gravity).toBeGreaterThanOrEqual(1); expect(p.likelihood).toBeGreaterThanOrEqual(1)
    }
    expect(new Set(r.map(p => p.id)).size).toBe(r.length)
  })
  it('sans doublon avec un intitulé déjà proposé ou présent (casse et espaces ignorés)', () => {
    const tous = risquesSectorielsProposes({ secteur: POSTAL, sousSecteurs: ['postal-colis'], locale: 'fr', exclus: [] })
    const r = risquesSectorielsProposes({ secteur: POSTAL, sousSecteurs: ['postal-colis'], locale: 'fr', exclus: [`  ${tous[0].title.toUpperCase()} `] })
    expect(r.map(p => p.title)).not.toContain(tous[0].title)
  })
  it('identifiant stable d’un appel à l’autre (création idempotente) ; sans secteur ni pattern : rien', () => {
    const a = risquesSectorielsProposes({ secteur: POSTAL, sousSecteurs: ['postal-colis'], locale: 'fr', exclus: [] }).map(p => p.id)
    const b = risquesSectorielsProposes({ secteur: POSTAL, sousSecteurs: ['postal-colis'], locale: 'fr', exclus: [] }).map(p => p.id)
    expect(a).toEqual(b)
    expect(risquesSectorielsProposes({ secteur: null, locale: 'fr', exclus: [] })).toEqual([])
  })
})
