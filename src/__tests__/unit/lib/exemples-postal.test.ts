// Pack postal, lot L3 : exemples EBIOS RM des ateliers 1 à 5 pour les services postaux et d'expédition (socle commun +
// éléments propres à chaque sous-secteur), textes ×5, énumérations valides, mêmes contenus pour la saisie directe.
import { describe, expect, it } from 'vitest'
import { SECTEURS_ACTIVITE, CATEGORIES_BIENS_SUPPORTS, TYPES_ACTION_ELEMENTAIRE } from '@/lib/ebios-data'
import { getEbiosData } from '@/lib/ebios-data-i18n'
import { sectorExemplesFor, type SectorExempleCategory } from '@/lib/exemples-sectoriels'
import { POSTAL_ITEMS } from '@/lib/exemples-postal'
import type { Locale } from '@/lib/i18n'
import { suggestRisqueExemples } from '@/lib/risque-exemples'

const POSTAL = 'Services postaux et d’expédition'
const IDS = ['postal-courrier', 'postal-colis', 'postal-reseau', 'postal-international', 'postal-elogistique', 'postal-domicile']
const CATS: SectorExempleCategory[] = ['valeursMetier', 'biensSupports', 'evenementsRedoutes', 'sourcesRisque', 'scenariosStrategiques', 'partiesPrenantes', 'actionsElementaires', 'mesuresEcosysteme', 'mesures']
const LOCS: Locale[] = ['en', 'de', 'es', 'it']
const textOf = (x: Record<string, unknown>) => String(x.nom ?? x.mesure ?? x.description ?? '')
const n = (cat: SectorExempleCategory, id?: string) => sectorExemplesFor(POSTAL, cat, 'fr', id).length

describe('exemples postaux — couverture', () => {
  it('colis : seuils minimaux par catégorie', () => {
    const min: Record<SectorExempleCategory, number> = { valeursMetier: 3, biensSupports: 5, evenementsRedoutes: 4, sourcesRisque: 4, scenariosStrategiques: 4, partiesPrenantes: 4, actionsElementaires: 4, mesuresEcosysteme: 3, mesures: 5 } as Record<SectorExempleCategory, number>
    for (const cat of CATS) expect(n(cat, 'postal-colis'), cat).toBeGreaterThanOrEqual(min[cat])
  })
  it('le secteur postal ne reçoit aucun exemple « médias » malgré « expédition »', () => {
    expect(JSON.stringify(sectorExemplesFor(POSTAL, 'valeursMetier', 'fr'))).not.toMatch(/rédaction|audience/i)
    expect(n('valeursMetier')).toBeGreaterThan(0)
  })
})

describe('exemples postaux — sous-professions', () => {
  it('aucun élément « colis » ne fuit vers le domicile ; le socle commun est proposé à tous', () => {
    const colisSeul = POSTAL_ITEMS.filter(x => x.profs && x.profs.includes('colis') && !x.profs.includes('domicile'))
    const domicile = JSON.stringify(CATS.flatMap(c => sectorExemplesFor(POSTAL, c, 'fr', 'postal-domicile')))
    for (const x of colisSeul) expect(domicile, JSON.stringify(x.data)).not.toContain(String((x.data.nom ?? x.data.mesure ?? x.data.description) as readonly string[] ? ((x.data.nom ?? x.data.mesure ?? x.data.description) as readonly string[])[0] : ''))
    const socle = POSTAL_ITEMS.filter(x => !x.profs && x.category === 'valeursMetier').map(x => (x.data.nom as readonly string[])[0])
    for (const id of IDS) {
      const noms = sectorExemplesFor(POSTAL, 'valeursMetier', 'fr', id).map(textOf)
      for (const s of socle) expect(noms, `${id}: ${s}`).toContain(s)
    }
  })
  it('chaque sous-secteur reçoit des valeurs métier et des mesures', () => {
    for (const id of IDS) { expect(n('valeursMetier', id), id).toBeGreaterThan(0); expect(n('mesures', id), id).toBeGreaterThan(0) }
  })
})

describe('exemples postaux — qualité des données', () => {
  it('5 langues non vides pour chaque texte ; traductions sans repli sur le français', () => {
    for (const x of POSTAL_ITEMS) for (const v of Object.values(x.data)) {
      const tr = Array.isArray(v) && v.length === 5 && v.every(s => typeof s === 'string') ? [v as readonly string[]] : Array.isArray(v) && Array.isArray(v[0]) ? (v as readonly string[][]) : []
      for (const t of tr) for (const s of t) expect(s.trim().length, JSON.stringify(t)).toBeGreaterThan(0)
    }
    const idx = SECTEURS_ACTIVITE.indexOf(POSTAL)
    for (const loc of LOCS) {
      const label = getEbiosData(loc).SECTEURS_ACTIVITE[idx]
      for (const cat of CATS) {
        const fr = sectorExemplesFor(POSTAL, cat, 'fr', 'postal-colis').map(textOf)
        const tr = sectorExemplesFor(label, cat, loc, 'postal-colis').map(textOf)
        expect(tr.length, `${loc}/${cat}`).toBe(fr.length)
        expect(tr.filter((t, i) => t === fr[i]), `${loc}/${cat}`).toEqual([])
      }
    }
  })
  it('énumérations valides (bien support, source de risque, partie prenante, action élémentaire, mesure)', () => {
    const typesBs = new Set<string>(CATEGORIES_BIENS_SUPPORTS.map(c => c.value))
    // Mêmes listes que lib/exemples-ateliers (catégories de source de risque, types de partie prenante).
    const SR = new Set(['CYBERCRIMINEL', 'ETAT_NATION', 'CONCURRENT', 'ACTIVISTE', 'EMPLOYE_MALVEILLANT', 'PRESTATAIRE', 'AMATEUR', 'TERRORISTE', 'AUTRE'])
    const PP = new Set(['PRESTATAIRE', 'FOURNISSEUR', 'CLIENT', 'PARTENAIRE', 'ORGANISME_REGULATION', 'AUTRE'])
    const AE = new Set(TYPES_ACTION_ELEMENTAIRE.map(t => t.value))
    for (const x of POSTAL_ITEMS) {
      if (x.category === 'biensSupports') expect(typesBs.has(String(x.data.type)), String(x.data.type)).toBe(true)
      if (x.category === 'sourcesRisque') expect(SR.has(String(x.data.categorie)), String(x.data.categorie)).toBe(true)
      if (x.category === 'partiesPrenantes') expect(PP.has(String(x.data.type)), String(x.data.type)).toBe(true)
      if (x.category === 'actionsElementaires') {
        expect(AE.has(String(x.data.type)), String(x.data.type)).toBe(true)
        expect(String(x.data.attack)).toMatch(/^T\d{4}(\.\d{3})?$/)
      }
      if (x.category === 'mesures') expect(['GOUVERNANCE', 'PROTECTION', 'DEFENSE', 'RESILIENCE']).toContain(x.data.categorieEbios)
    }
  })
})

describe('exemples postaux — saisie directe (ISO 27005, ISO 31000, NIST)', () => {
  it('les scénarios postaux alimentent les risques suggérés d’une analyse du secteur postal', () => {
    const r = suggestRisqueExemples({ secteur: POSTAL, sousSecteur: 'postal-colis', locale: 'fr' })
    expect(r.some(x => x.pertinent && /API de suivi/i.test(x.intitule))).toBe(true)
    expect(r.some(x => /réexpédition/i.test(x.intitule))).toBe(false)
  })
})

