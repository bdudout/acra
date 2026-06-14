import { describe, it, expect } from 'vitest'
import { defaultExemplesFor, type ExemplesTranslations } from '@/lib/exemples-defaults'
import { fr } from '@/lib/i18n/fr'
import {
  VALEURS_METIER_EXEMPLES,
  BIENS_SUPPORTS_EXEMPLES,
  EVENEMENTS_REDOUTES_EXEMPLES,
} from '@/lib/ebios-data'

const t = fr as unknown as ExemplesTranslations

describe('defaultExemplesFor', () => {
  it('valeurs métier : même cardinalité + champs structurels conservés', () => {
    const d = defaultExemplesFor('valeursMetier', t)
    expect(d).toHaveLength(VALEURS_METIER_EXEMPLES.length)
    expect(d[0]).toHaveProperty('nom')
    expect(d[0].type).toBe(VALEURS_METIER_EXEMPLES[0].type)
    expect(d[0].disponibilite).toBe(VALEURS_METIER_EXEMPLES[0].disponibilite)
  })

  it('biens supports : type conservé, nom traduit (repli FR)', () => {
    const d = defaultExemplesFor('biensSupports', t)
    expect(d).toHaveLength(BIENS_SUPPORTS_EXEMPLES.length)
    expect(d[0].type).toBe(BIENS_SUPPORTS_EXEMPLES[0].type)
    expect(d[0].nom).toBeTruthy()
  })

  it('événements redoutés : impacts en tableau + graviteDefaut', () => {
    const d = defaultExemplesFor('evenementsRedoutes', t)
    expect(d).toHaveLength(EVENEMENTS_REDOUTES_EXEMPLES.length)
    expect(Array.isArray(d[0].impacts)).toBe(true)
    expect(d[0].graviteDefaut).toBe(EVENEMENTS_REDOUTES_EXEMPLES[0].graviteDefaut)
  })

  it('ateliers 2 à 5 : défauts non vides + champ primary présent', () => {
    const cases: [string, string][] = [
      ['sourcesRisque', 'nom'],
      ['objectifsVises', 'nom'],
      ['scenariosStrategiques', 'nom'],
      ['partiesPrenantes', 'nom'],
      ['actionsElementaires', 'nom'],
      ['mesuresEcosysteme', 'mesure'],
    ]
    for (const [key, primary] of cases) {
      const d = defaultExemplesFor(key as never, t)
      expect(d.length, key).toBeGreaterThan(0)
      expect(String(d[0][primary] ?? ''), `${key}.${primary}`).not.toBe('')
    }
  })

  it('catégorie sans défaut connu -> tableau vide', () => {
    expect(defaultExemplesFor('inconnue' as never, t)).toEqual([])
  })

  it('tolère un objet de traductions incomplet (repli sur ebios-data)', () => {
    const d = defaultExemplesFor('valeursMetier', {} as ExemplesTranslations)
    expect(d).toHaveLength(VALEURS_METIER_EXEMPLES.length)
    expect(d[0].nom).toBe(VALEURS_METIER_EXEMPLES[0].nom)
  })
})
