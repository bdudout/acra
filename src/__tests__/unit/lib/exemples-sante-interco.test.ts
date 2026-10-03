import { describe, expect, it } from 'vitest'
import { sectorExemplesFor, type SectorExempleCategory } from '@/lib/exemples-sectoriels'
import { secteurFamily, sousSecteurIdsFor } from '@/lib/sous-secteurs'
import { patternExemplesFor } from '@/lib/exemples-patterns'
import { SECTEURS_ACTIVITE } from '@/lib/ebios-data'
import { getEbiosData } from '@/lib/ebios-data-i18n'
import { suggestRisqueExemples } from '@/lib/risque-exemples'
import { CATEGORIES_MESURE_EBIOS } from '@/lib/mesure-categorie'
import type { Locale } from '@/lib/i18n'

const SANTE = 'Santé / Médico-social'
const TECH = 'Technique / Interconnexion de SI'
const LOCALES: Locale[] = ['en', 'de', 'es', 'it']
const ALL_CATS: SectorExempleCategory[] = ['valeursMetier', 'biensSupports', 'evenementsRedoutes', 'sourcesRisque', 'scenariosStrategiques', 'partiesPrenantes', 'actionsElementaires', 'mesuresEcosysteme', 'mesures']
const NEW_SANTE = ['sante-portail', 'sante-entrepot', 'sante-delegataire']
// Le secteur « Technique / Interconnexion de SI » a été remplacé par des patterns d'architecture (décision D1).
const INTERCO_PATTERNS = ['INTERCO_TIERS', 'EXTERNALISATION_DONNEES', 'API_PARTENAIRES', 'ECHANGE_FICHIERS']
const TYPES_MESURE = ['PREVENTIVE', 'DETECTIVE', 'CORRECTIVE', 'DISSUASIVE', 'ORGANISATIONNELLE', 'TECHNIQUE']
const textOf = (x: Record<string, unknown>) => String(x.nom ?? x.mesure ?? x.description ?? '')

describe('santé : portail, entrepôt de données, délégataire de gestion', () => {
  it('les nouveaux sous-secteurs sont proposés pour le secteur santé', () => {
    const ids = sousSecteurIdsFor(SANTE)
    for (const id of NEW_SANTE) expect(ids, id).toContain(id)
  })
  it('chaque nouveau sous-secteur reçoit des exemples dans toutes les catégories (ateliers 1 à 5)', () => {
    for (const id of NEW_SANTE) for (const cat of ALL_CATS) {
      expect(sectorExemplesFor(SANTE, cat, 'fr', id).length, `${id}/${cat}`).toBeGreaterThan(0)
    }
    expect(sectorExemplesFor(SANTE, 'mesures', 'fr', 'sante-portail').length).toBeGreaterThanOrEqual(8)
    // Les mesures propres au sous-secteur passent avant les mesures communes au secteur.
    expect(String(sectorExemplesFor(SANTE, 'mesures', 'fr', 'sante-portail')[0].nom)).toMatch(/patients/)
    expect(String(patternExemplesFor(['EXTERNALISATION_DONNEES'], 'mesures', 'fr')[0].nom)).toMatch(/livraison/)
  })
  it('le portail voit l’usurpation de compte patient et l’accès direct à un objet non autorisé, pas l’entrepôt de recherche', () => {
    const p = JSON.stringify(ALL_CATS.flatMap(c => sectorExemplesFor(SANTE, c, 'fr', 'sante-portail')))
    expect(p).toMatch(/compte patient/i); expect(p).toMatch(/API/); expect(p).not.toMatch(/réidentification/i)
    const e = JSON.stringify(ALL_CATS.flatMap(c => sectorExemplesFor(SANTE, c, 'fr', 'sante-entrepot')))
    expect(e).toMatch(/réidentification/i)
  })
  it('assurance santé / mutuelle (AMC) et tiers payant reçoivent un plan de traitement (mesures) et des actions élémentaires', () => {
    for (const id of ['sante-amc', 'sante-tiers-payant', 'sante-esante', 'sante-amo', 'sante-hopital', 'sante-cabinet']) {
      expect(sectorExemplesFor(SANTE, 'mesures', 'fr', id).length, id).toBeGreaterThanOrEqual(6)
    }
    expect(JSON.stringify(sectorExemplesFor(SANTE, 'mesures', 'fr', 'sante-amc'))).toMatch(/coordonnées bancaires/i)
    expect(sectorExemplesFor(SANTE, 'actionsElementaires', 'fr', 'sante-amc').length).toBeGreaterThanOrEqual(3)
  })
  it('les exemples détaillés n’apparaissent pas sans sous-secteur (seules les mesures générales de santé)', () => {
    const tout = JSON.stringify(ALL_CATS.flatMap(c => sectorExemplesFor(SANTE, c, 'fr')))
    expect(tout).not.toMatch(/compte patient|réidentification|organisme délégant/i)
    expect(sectorExemplesFor(SANTE, 'mesures', 'fr').length).toBeGreaterThan(0)
  })
  it('les suggestions de risques (saisie directe) reprennent le contenu du portail', () => {
    const s = suggestRisqueExemples({ secteur: SANTE, sousSecteur: 'sante-portail', limit: 30 })
    expect(s.some(r => /portail|compte patient|API/i.test(r.intitule))).toBe(true)
  })
})

describe('ancienne catégorie « Technique / Interconnexion de SI » : remplacée par des patterns', () => {
  it('n’existe plus dans la liste des secteurs (5 langues) ni comme famille ; « Autre » reste en dernier', () => {
    expect(SECTEURS_ACTIVITE).not.toContain(TECH)
    expect(SECTEURS_ACTIVITE.at(-1)).toBe('Autre')
    expect(secteurFamily(TECH)).toBeNull()
    for (const loc of ['fr', ...LOCALES] as Locale[]) {
      const list = getEbiosData(loc).SECTEURS_ACTIVITE
      expect(list.length, loc).toBe(SECTEURS_ACTIVITE.length)
      expect(list.some((x: string) => /interconnex|interconnection|kopplung|interconnessione/i.test(x)), loc).toBe(false)
    }
  })
  it('plus aucun sous-secteur « technique-* » proposé', () => {
    expect(sousSecteurIdsFor(TECH)).toEqual([])
    expect(sousSecteurIdsFor(SANTE).some(i => i.startsWith('technique-'))).toBe(false)
  })
  it('chacun des 4 patterns reprenant le contenu a des exemples dans toutes les catégories', () => {
    for (const code of INTERCO_PATTERNS) for (const cat of ALL_CATS) {
      expect(patternExemplesFor([code], cat, 'fr').length, `${code}/${cat}`).toBeGreaterThan(0)
    }
  })
  it('contenu repris : prestataire (complétude, totaux), API (OWASP API Security Top 10), socle d’interconnexion (filtrage des flux)', () => {
    const presta = JSON.stringify(patternExemplesFor(['EXTERNALISATION_DONNEES'], 'mesures', 'fr'))
    expect(presta).toMatch(/complétude|totaux de contrôle/i); expect(presta).not.toMatch(/OWASP API Security/)
    expect(JSON.stringify(patternExemplesFor(['API_PARTENAIRES'], 'mesures', 'fr'))).toMatch(/OWASP API Security Top 10/)
    const socle = JSON.stringify(patternExemplesFor(['INTERCO_TIERS'], 'mesures', 'fr'))
    expect(socle).toMatch(/Filtrage strict des flux/); expect(socle).not.toMatch(/quarantaine des livraisons/i)
  })
})

describe('forme et traduction du nouveau contenu', () => {
  const cases: [string, string][] = [...NEW_SANTE.map(s => [SANTE, s] as [string, string]), [SANTE, 'sante-amc'], [SANTE, 'sante-tiers-payant']]
  it('mesures : type de mesure et catégorie EBIOS valides, priorité 1 à 4, références courtes', () => {
    for (const [sec, sub] of cases) for (const m of sectorExemplesFor(sec, 'mesures', 'fr', sub)) {
      expect(TYPES_MESURE, `${sub} ${textOf(m)}`).toContain(m.type)
      expect(CATEGORIES_MESURE_EBIOS as readonly string[]).toContain(m.categorieEbios)
      expect(m.prioriteDefaut).toBeGreaterThanOrEqual(1); expect(m.prioriteDefaut).toBeLessThanOrEqual(4)
      for (const r of (m.references as string[] | undefined) ?? []) expect(r.length).toBeLessThanOrEqual(160)
    }
  })
  it('traduit en EN / DE / ES / IT : aucun libellé du nouveau contenu ne reste en français', () => {
    for (const loc of LOCALES) for (const [sec, sub] of cases) for (const cat of ['actionsElementaires', 'mesuresEcosysteme', 'mesures'] as SectorExempleCategory[]) {
      const secLoc = sec
      const fr = sectorExemplesFor(sec, cat, 'fr', sub).map(textOf)
      const tr = sectorExemplesFor(secLoc, cat, loc, sub).map(textOf)
      expect(tr.length, `${loc}/${sub}/${cat}`).toBe(fr.length)
      expect(tr.filter((t, i) => t === fr[i]), `${loc}/${sub}/${cat}`).toEqual([])
    }
  })
  it('les champs de catégorie restent des valeurs d’énumération (non traduites) et le champ technique est retiré', () => {
    const x = patternExemplesFor(['EXTERNALISATION_DONNEES'], 'actionsElementaires', 'de')
    expect(x.every(a => ['RECONNAISSANCE', 'ACCES_INITIAL', 'PERSISTANCE', 'ESCALADE_PRIVILEGES', 'MOUVEMENT_LATERAL', 'EXFILTRATION', 'IMPACT'].includes(String(a.type)))).toBe(true)
    expect(x.every(a => !('sousProfession' in a) && !('profs' in a))).toBe(true)
  })
  it('patterns d’interconnexion : traduits en EN / DE / ES / IT, aucun libellé ne reste en français', () => {
    for (const loc of LOCALES) for (const code of INTERCO_PATTERNS) for (const cat of ['actionsElementaires', 'mesuresEcosysteme', 'mesures'] as SectorExempleCategory[]) {
      const fr = patternExemplesFor([code], cat, 'fr').map(textOf)
      const tr = patternExemplesFor([code], cat, loc).map(textOf)
      expect(tr.length, `${loc}/${code}/${cat}`).toBe(fr.length)
      expect(tr.filter((t, i) => t === fr[i]), `${loc}/${code}/${cat}`).toEqual([])
    }
  })
})
