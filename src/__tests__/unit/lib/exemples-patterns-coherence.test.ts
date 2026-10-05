/**
 * Cohérence du contenu des patterns d'architecture : chaque pattern proposé à la création d'une analyse alimente les
 * ateliers où il a un sens, sans texte de gabarit ni doublon. Critère d'arrêt des passes de contenu.
 */
import { describe, expect, it } from 'vitest'
import { PATTERN_ITEMS, localizePatternItem } from '@/lib/exemples-patterns'
import { ARCHI_PATTERNS } from '@/lib/patterns-archi'

const own = (code: string, cat: string) => PATTERN_ITEMS.filter(i => i.category === cat && i.patterns.length === 1 && i.patterns[0] === code)

/** Ateliers 1, 3, 4, 5 : tout pattern change les biens supports, les ER, les chemins d'attaque et les mesures. */
const TOUJOURS = ['biensSupports', 'evenementsRedoutes', 'scenariosStrategiques', 'actionsElementaires', 'mesures']
/** Patterns qui impliquent un tiers : partie prenante (atelier 3) et mesure sur l'écosystème. */
const AVEC_TIERS = ['EXPOSITION_INTERNET', 'ACCES_DISTANT', 'APPLICATIONS_MOBILES', 'INTERCO_TIERS', 'API_PARTENAIRES', 'ECHANGE_FICHIERS',
  'EXTERNALISATION_DONNEES', 'TELEMAINTENANCE', 'CLOUD_SAAS', 'CLOUD_IAAS_PAAS', 'SI_ADMINISTRATION', 'FLUX_INTERNES_DC', 'SAUVEGARDE',
  'SUPERVISION', 'BUREAUTIQUE', 'SI_TPE', 'IA_SERVICES', 'SI_INDUSTRIEL', 'SI_PATRIMONIAL']
/** Patterns qui changent le profil de menace : source de risque propre (atelier 2). */
const AVEC_SOURCE = ['EXPOSITION_INTERNET', 'ACCES_DISTANT', 'APPLICATIONS_MOBILES', 'ZONE_MOINDRE_CONFIANCE', 'INTERCO_TIERS',
  'EXTERNALISATION_DONNEES', 'TELEMAINTENANCE', 'SI_ADMINISTRATION', 'BUREAUTIQUE', 'IA_SERVICES', 'SI_INDUSTRIEL', 'SI_SENSIBLE']

describe('couverture des ateliers par pattern', () => {
  for (const { code } of ARCHI_PATTERNS) {
    it(`${code} : ateliers 1, 3, 4, 5`, () => {
      for (const cat of TOUJOURS) expect(own(code, cat).length, `${code} / ${cat}`).toBeGreaterThan(0)
    })
  }
  for (const code of AVEC_TIERS) {
    it(`${code} : partie prenante et mesure d'écosystème`, () => {
      expect(own(code, 'partiesPrenantes').length, `${code} / pp`).toBeGreaterThan(0)
      expect(own(code, 'mesuresEcosysteme').length, `${code} / me`).toBeGreaterThan(0)
    })
  }
  for (const code of AVEC_SOURCE) {
    it(`${code} : source de risque`, () => expect(own(code, 'sourcesRisque').length, code).toBeGreaterThan(0))
  }
})

describe('qualité', () => {
  const texte = (i: (typeof PATTERN_ITEMS)[number]) => { const x = localizePatternItem(i, 'fr'); return String(x.nom ?? x.mesure ?? x.description) }
  it('aucun texte de gabarit (« X — composants, comptes et données associés », « faute de mesures adaptées »)', () => {
    const fautifs = PATTERN_ITEMS.map(texte).filter(t => /composants, comptes et données associés|faute de mesures adaptées|revue de sécurité et de dépendances|à inventorier avec ses dépendances/.test(t))
    expect(fautifs).toEqual([])
  })
  it('aucun doublon de texte d’un pattern à l’autre dans une même catégorie', () => {
    const vus = new Map<string, string>(); const doublons: string[] = []
    for (const i of PATTERN_ITEMS) { const k = `${i.category}|${texte(i).toLowerCase()}`; if (vus.has(k)) doublons.push(k); vus.set(k, i.patterns.join('+')) }
    expect(doublons).toEqual([])
  })
})
