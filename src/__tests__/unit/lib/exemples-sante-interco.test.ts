import { describe, expect, it } from 'vitest'
import { sectorExemplesFor, type SectorExempleCategory } from '@/lib/exemples-sectoriels'
import { secteurFamily, sousSecteurIdsFor } from '@/lib/sous-secteurs'
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
const TECH_SUBS = ['technique-interco-prestataire', 'technique-interco-metier', 'technique-api-exposee', 'technique-integration']
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
    expect(String(sectorExemplesFor(TECH, 'mesures', 'fr', 'technique-interco-prestataire')[0].nom)).toMatch(/livraison/)
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

describe('nouvelle catégorie « Technique / Interconnexion de SI »', () => {
  it('existe dans la liste des secteurs, avant « Autre », et forme sa propre famille dans les 5 langues', () => {
    const i = SECTEURS_ACTIVITE.indexOf(TECH)
    expect(i).toBeGreaterThan(-1); expect(SECTEURS_ACTIVITE[i + 1]).toBe('Autre')
    for (const loc of ['fr', ...LOCALES] as Locale[]) {
      const label = getEbiosData(loc).SECTEURS_ACTIVITE[i]
      expect(secteurFamily(label), `${loc}: ${label}`).toBe('technique')
      expect(sectorExemplesFor(label, 'valeursMetier', loc).length, loc).toBeGreaterThan(0)
      expect(getEbiosData(loc).SECTEURS_ACTIVITE.at(-1)).not.toBe(label)
    }
  })
  it('propose 4 sous-secteurs (prestataire qui livre des données, échange métier, API exposée, plateforme d’intégration)', () => {
    expect(sousSecteurIdsFor(TECH)).toEqual(TECH_SUBS)
  })
  it('chaque sous-secteur a des exemples dans toutes les catégories, dont un plan de traitement fourni', () => {
    for (const id of TECH_SUBS) for (const cat of ALL_CATS) {
      expect(sectorExemplesFor(TECH, cat, 'fr', id).length, `${id}/${cat}`).toBeGreaterThan(0)
    }
    const presta = JSON.stringify(sectorExemplesFor(TECH, 'mesures', 'fr', 'technique-interco-prestataire'))
    expect(presta).toMatch(/complétude|totaux de contrôle/i); expect(presta).not.toMatch(/OWASP API Security/)
    expect(JSON.stringify(sectorExemplesFor(TECH, 'mesures', 'fr', 'technique-api-exposee'))).toMatch(/OWASP API Security Top 10/)
  })
  it('sans sous-secteur, seuls les exemples communs aux interconnexions sont proposés', () => {
    const vm = JSON.stringify(sectorExemplesFor(TECH, 'mesures', 'fr'))
    expect(vm).toMatch(/Filtrage strict des flux/); expect(vm).not.toMatch(/quarantaine des livraisons/i)
  })
})

describe('forme et traduction du nouveau contenu', () => {
  const cases: [string, string][] = [...NEW_SANTE.map(s => [SANTE, s] as [string, string]), ...TECH_SUBS.map(s => [TECH, s] as [string, string]), [SANTE, 'sante-amc'], [SANTE, 'sante-tiers-payant']]
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
      const secLoc = sec === TECH ? getEbiosData(loc).SECTEURS_ACTIVITE[SECTEURS_ACTIVITE.indexOf(TECH)] : sec
      const fr = sectorExemplesFor(sec, cat, 'fr', sub).map(textOf)
      const tr = sectorExemplesFor(secLoc, cat, loc, sub).map(textOf)
      expect(tr.length, `${loc}/${sub}/${cat}`).toBe(fr.length)
      expect(tr.filter((t, i) => t === fr[i]), `${loc}/${sub}/${cat}`).toEqual([])
    }
  })
  it('les champs de catégorie restent des valeurs d’énumération (non traduites) et le champ technique est retiré', () => {
    const x = sectorExemplesFor(TECH, 'actionsElementaires', 'de', 'technique-interco-prestataire')
    expect(x.every(a => ['RECONNAISSANCE', 'ACCES_INITIAL', 'PERSISTANCE', 'ESCALADE_PRIVILEGES', 'MOUVEMENT_LATERAL', 'EXFILTRATION', 'IMPACT'].includes(String(a.type)))).toBe(true)
    expect(x.every(a => !('sousProfession' in a) && !('profs' in a))).toBe(true)
  })
})
