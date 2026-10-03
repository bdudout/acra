// Lot A2 — moteur d'exemples : union sous-secteurs + patterns + socle du secteur, ordre, combinaisons, sans doublon.
import { describe, it, expect } from 'vitest'
import { selectPatternItems, type PatternItem } from '@/lib/exemples-patterns'
import { sectorExemplesFor, withSectorExemples, SECTOR_FAMILIES, type SectorExempleCategory } from '@/lib/exemples-sectoriels'

const item = (patterns: string[], nom: string, extra: Partial<PatternItem> = {}): PatternItem => ({ category: 'biensSupports', patterns, data: { nom, type: 'RESEAU', description: nom }, ...extra })

describe('selectPatternItems (sélection pure)', () => {
  const items = [
    item(['DMZ'], 'Reverse proxy'),
    item(['INTERCO_TIERS'], 'Lien dédié partenaire'),
    item(['TELEMAINTENANCE', 'SI_INDUSTRIEL'], 'Prise de main sur automate'),
    item(['SI_TPE', 'EXTERNALISATION_DONNEES'], 'Prestataire unique sans réversibilité'),
    item(['DMZ'], 'Autre catégorie', { category: 'mesures' }),
    item(['DMZ'], 'Réservé santé', { familles: ['sante'] }),
  ]
  it('pattern non coché : rien', () => expect(selectPatternItems(items, [], 'biensSupports', 'banque')).toEqual([]))
  it('pattern coché : ses éléments seulement, de la catégorie demandée', () => {
    expect(selectPatternItems(items, ['DMZ'], 'biensSupports', 'banque').map(i => i.data.nom)).toEqual(['Reverse proxy'])
    expect(selectPatternItems(items, ['DMZ'], 'mesures', 'banque').map(i => i.data.nom)).toEqual(['Autre catégorie'])
  })
  it('combinaison : visible seulement si TOUS les patterns requis sont cochés', () => {
    expect(selectPatternItems(items, ['TELEMAINTENANCE'], 'biensSupports', null)).toEqual([])
    expect(selectPatternItems(items, ['SI_INDUSTRIEL'], 'biensSupports', null)).toEqual([])
    expect(selectPatternItems(items, ['TELEMAINTENANCE', 'SI_INDUSTRIEL'], 'biensSupports', null).map(i => i.data.nom)).toEqual(['Prise de main sur automate'])
  })
  it('ordre : éléments d’un seul pattern dans l’ordre de sélection, puis les combinaisons', () => {
    const r = selectPatternItems(items, ['SI_TPE', 'EXTERNALISATION_DONNEES', 'INTERCO_TIERS', 'DMZ'], 'biensSupports', null).map(i => i.data.nom)
    expect(r).toEqual(['Lien dédié partenaire', 'Reverse proxy', 'Prestataire unique sans réversibilité'])
  })
  it('variante sectorielle : l’élément réservé à une famille n’apparaît que pour elle', () => {
    expect(selectPatternItems(items, ['DMZ'], 'biensSupports', 'sante').map(i => i.data.nom)).toEqual(['Reverse proxy', 'Réservé santé'])
    expect(selectPatternItems(items, ['DMZ'], 'biensSupports', null).map(i => i.data.nom)).toEqual(['Reverse proxy'])
  })
})

const CATS: SectorExempleCategory[] = ['valeursMetier', 'biensSupports', 'evenementsRedoutes', 'sourcesRisque', 'scenariosStrategiques', 'partiesPrenantes', 'actionsElementaires', 'mesuresEcosysteme', 'mesures']
const SECTEURS = ['Santé', 'Banque / Finance / Assurance', 'Industrie', 'Administration publique', 'Transport', 'Commerce']
const key = (x: Record<string, unknown>) => String(x.nom ?? x.mesure ?? x.description ?? '').toLowerCase().trim()

describe('moteur : sans pattern, contenu strictement inchangé', () => {
  it('identique à l’appel historique (toutes catégories, plusieurs secteurs, avec et sans sous-secteur)', () => {
    for (const s of SECTEURS) for (const c of CATS) {
      const legacy = sectorExemplesFor(s, c, 'fr')
      expect(sectorExemplesFor(s, c, 'fr', undefined, [])).toEqual(legacy)
      expect(sectorExemplesFor(s, c, 'fr', undefined, undefined)).toEqual(legacy)
    }
    expect(sectorExemplesFor('Santé', 'valeursMetier', 'fr', ['sante-cabinet'], [])).toEqual(sectorExemplesFor('Santé', 'valeursMetier', 'fr', ['sante-cabinet']))
  })
  it('withSectorExemples : même résultat sans pattern', () => {
    const generic = [{ nom: 'Générique A' }, { nom: 'Générique B' }]
    expect(withSectorExemples(generic, 'Santé', 'valeursMetier', 'fr', undefined, [])).toEqual(withSectorExemples(generic, 'Santé', 'valeursMetier', 'fr'))
  })
})

describe('moteur : union avec les patterns cochés', () => {
  it('sans doublon : les éléments sont uniques par nom', () => {
    for (const c of CATS) {
      const r = sectorExemplesFor('Santé', c, 'fr', undefined, ['EXPOSITION_INTERNET', 'INTERCO_TIERS', 'DMZ'])
      const keys = r.map(key).filter(Boolean)
      expect(new Set(keys).size, c).toBe(keys.length)
    }
  })
  it('conserve tout le contenu du secteur et ajoute celui des patterns', () => {
    const base = sectorExemplesFor('Santé', 'biensSupports', 'fr')
    const withP = sectorExemplesFor('Santé', 'biensSupports', 'fr', undefined, ['EXPOSITION_INTERNET'])
    for (const b of base) expect(withP.map(key)).toContain(key(b))
    expect(withP.length).toBeGreaterThan(base.length)
  })
  it('indépendant du secteur : proposé aussi sans secteur ou avec « Autre »', () => {
    expect(sectorExemplesFor(null, 'biensSupports', 'fr', undefined, ['EXPOSITION_INTERNET']).length).toBeGreaterThan(0)
    expect(sectorExemplesFor('Autre', 'biensSupports', 'fr', undefined, ['EXPOSITION_INTERNET']).length).toBeGreaterThan(0)
  })
  it('un pattern non coché n’apporte rien', () => {
    const a = sectorExemplesFor('Banque / Finance / Assurance', 'biensSupports', 'fr', undefined, ['DMZ']).map(key)
    const b = sectorExemplesFor('Banque / Finance / Assurance', 'biensSupports', 'fr', undefined, ['TELEMAINTENANCE']).map(key)
    expect(a).not.toEqual(b)
  })
  it('patterns propres d’abord (avant le socle commun), sous-secteur d’abord', () => {
    const r = sectorExemplesFor('Santé', 'biensSupports', 'fr', undefined, ['EXPOSITION_INTERNET']).map(key)
    const patternFirst = sectorExemplesFor(null, 'biensSupports', 'fr', undefined, ['EXPOSITION_INTERNET']).map(key)[0]
    const base = sectorExemplesFor('Santé', 'biensSupports', 'fr').map(key)
    expect(r.indexOf(patternFirst)).toBeGreaterThanOrEqual(0)
    expect(r.indexOf(patternFirst)).toBeLessThan(r.indexOf(base[base.length - 1]))
  })
  it('localisé : le contenu d’un pattern diffère entre le français et l’anglais', () => {
    const fr = sectorExemplesFor(null, 'biensSupports', 'fr', undefined, ['EXPOSITION_INTERNET']).map(key)
    const en = sectorExemplesFor(null, 'biensSupports', 'en', undefined, ['EXPOSITION_INTERNET']).map(key)
    expect(fr).not.toEqual(en)
  })
  it('code de pattern inconnu ignoré', () => {
    expect(sectorExemplesFor('Santé', 'biensSupports', 'fr', undefined, ['PIRATE'])).toEqual(sectorExemplesFor('Santé', 'biensSupports', 'fr'))
  })
  it('SECTOR_FAMILIES reste exporté (compat.)', () => expect(SECTOR_FAMILIES.length).toBeGreaterThan(5))
})
