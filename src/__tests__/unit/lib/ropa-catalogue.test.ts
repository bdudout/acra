import { describe, it, expect } from 'vitest'
import { listRopaTemplates, ROPA_PLACEHOLDER_KEY, ROPA_TEMPLATES } from '@/lib/ropa-catalogue'
import { champsManquantsArt30, sanitizeTraitement, BASES_LEGALES } from '@/lib/ropa'
import { detectPersonnesVulnerables } from '@/lib/rgpd-sensitive'

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

// Pack postal L5.2 : traitements types du secteur postal, présentés en tête pour une organisation du secteur ; durées
// reprises des fiches CNIL, sinon laissées à compléter (jamais inventées).
describe('traitements types — services postaux', () => {
  const postaux = (l: (typeof LOCALES)[number] = 'fr') => listRopaTemplates(l, ['POSTAL']).filter(t => t.key.startsWith('ropa.postal.'))
  it('absents sans le secteur ; en tête avec le secteur POSTAL (8 traitements)', () => {
    expect(listRopaTemplates('fr').some(t => t.key.startsWith('ropa.postal.'))).toBe(false)
    expect(listRopaTemplates('fr', ['SANTE']).some(t => t.key.startsWith('ropa.postal.'))).toBe(false)
    const liste = listRopaTemplates('fr', ['POSTAL'])
    expect(postaux()).toHaveLength(8)
    expect(liste.slice(0, 8).every(t => t.key.startsWith('ropa.postal.'))).toBe(true)
    expect(liste.length).toBe(listRopaTemplates('fr').length + 8)
  })
  it('durées : géolocalisation et vidéoprotection d’après la CNIL ; sinon à compléter', () => {
    const d = Object.fromEntries(postaux().map(t => [t.key, t.dureeConservation]))
    expect(d['ropa.postal.geolocation']).toMatch(/2 mois/)
    expect(d['ropa.postal.cctv']).toMatch(/un mois/)
    for (const k of ['ropa.postal.proof-of-delivery', 'ropa.postal.forwarding', 'ropa.postal.merchant-recipients', 'ropa.postal.home-services', 'ropa.postal.counter-identity', 'ropa.postal.call-recording']) expect(d[k], k).toBe('')
  })
  it('5 langues alignées ; prestations au domicile → personnes vulnérables ; rôle des données e-commerçants à qualifier par le DPO', () => {
    const fr = postaux('fr')
    for (const l of LOCALES) postaux(l).forEach((t, i) => {
      expect(t.nom.trim(), `${l} ${t.key}`).not.toBe(''); expect(t.finalite.trim(), `${l} ${t.key}`).not.toBe('')
      expect(t.categoriesPersonnes.length, `${l} ${t.key}`).toBe(fr[i].categoriesPersonnes.length)
      expect(t.categoriesDonnees.length, `${l} ${t.key}`).toBe(fr[i].categoriesDonnees.length)
      if (t.key === 'ropa.postal.home-services') expect(detectPersonnesVulnerables(t.categoriesPersonnes), l).toBe(true)
    })
    expect(fr.find(t => t.key === 'ropa.postal.merchant-recipients')!.finalite).toMatch(/DPO/)
  })
})

