import { describe, expect, it } from 'vitest'
import { IA_PLACEHOLDER_KEY, listSystemesIaTypes, type IaLocale } from '@/lib/registre-ia-catalogue'
import { champsManquantsIa, classeIndicative, sanitizeSystemeIa } from '@/lib/registre-ia'

const LOCALES: IaLocale[] = ['fr', 'en', 'de', 'es', 'it']

describe('catalogue des systèmes d’IA types', () => {
  it('mêmes clés dans les 5 langues, textes non vides, clés uniques', () => {
    const fr = listSystemesIaTypes('fr').map(s => s.key)
    expect(new Set(fr).size).toBe(fr.length)
    for (const l of LOCALES) {
      const items = listSystemesIaTypes(l)
      expect(items.map(s => s.key)).toEqual(fr)
      for (const s of items.filter(x => x.key !== IA_PLACEHOLDER_KEY)) {
        expect(s.nom && s.finalite && s.interventionHumaine && s.controlesBiais, `${l} ${s.key}`).toBeTruthy()
        expect(s.donnees.length).toBeGreaterThan(0)
      }
    }
  })
  it('les systèmes types valident le nettoyage et couvrent les trois classes indicatives', () => {
    const items = listSystemesIaTypes('fr')
    for (const s of items) expect(sanitizeSystemeIa(s)).toMatchObject({ nom: s.nom, usage: s.usage, typeDecision: s.typeDecision })
    const classes = new Set(items.map(s => classeIndicative(s.usage, s.typeDecision)))
    expect(classes).toEqual(new Set(['HAUT_RISQUE_PROBABLE', 'RISQUE_LIMITE', 'A_QUALIFIER']))
  })
  it('fournisseur toujours à compléter ; système propre à l’activité laissé incomplet', () => {
    const items = listSystemesIaTypes('fr')
    expect(items.every(s => s.fournisseur === null && s.statut === 'EN_PROJET')).toBe(true)
    const ph = items.find(s => s.key === IA_PLACEHOLDER_KEY)!
    expect(champsManquantsIa(sanitizeSystemeIa(ph))).toEqual(['fournisseur', 'donnees', 'interventionHumaine', 'controlesBiais'])
  })
})
