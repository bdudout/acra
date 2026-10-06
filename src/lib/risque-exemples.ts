// ─── Suggestions de risques sectoriels (saisie directe) ──────────────────────
// R3 du chantier multi-méthode : propose des risques « prêts à cliquer » pour les
// parcours à saisie directe (ISO 31000 / ISO 27005 / NIST 800-30), dérivés des
// packs sectoriels existants (`exemples-sectoriels.ts`). Deux sources :
//   - scénarios stratégiques  → intitulé = nom ; G/V = valeurs d'origine ;
//   - événements redoutés      → intitulé = description ; G d'origine, V par défaut.
// Classement par pertinence (secteur / sous-secteur) via `rankExemples`. Les
// valeurs G/V restent des SUGGESTIONS clairement modifiables (l'UI pré-remplit un
// formulaire, elle ne crée rien sans confirmation). Module PUR → testé.

import type { Locale } from '@/lib/i18n'
import { sectorExemplesFor } from '@/lib/exemples-sectoriels'
import { rankExemples } from '@/lib/exemples-context'
import { listSectorSuggestions } from '@/lib/sector-suggestions'
import { codesCatalogueSecteur } from '@/lib/secteur-catalogue'
import { domaineFromTaxonomie } from '@/lib/projet360'
import { GROUPES_RISQUES_TYPES, type GroupeRisqueType, type RisqueType } from '@/lib/risques-types'

/** Suggestion de risque à saisie directe (intitulé + gravité/vraisemblance suggérées). */
export interface RisqueExemple {
  intitule: string
  gravite: number
  vraisemblance: number
  /** Vrai si l'exemple est jugé pertinent pour le contexte (badge UI). */
  pertinent: boolean
  /** Analyse projet 360 : domaine proposé et origine (risque déjà au registre de l'organisation). */
  domaine?: string
  source?: 'REGISTRE'
}

/** Valeur par défaut d'une vraisemblance absente (événements redoutés). */
const V_DEFAULT = 2

/** Ramène une note dans l'échelle 1..4 (repli sur `def`). */
function clamp1to4(v: unknown, def: number): number {
  const n = typeof v === 'number' ? Math.round(v) : NaN
  return Number.isFinite(n) ? Math.min(4, Math.max(1, n)) : def
}

/**
 * Retire le suffixe de critère EBIOS « (C) / (I) / (D) / (T) » d'un intitulé
 * (Confidentialité/Intégrité/Disponibilité/Traçabilité). Ces suffixes viennent des
 * scénarios stratégiques EBIOS et n'ont pas de sens pour les méthodes à saisie
 * directe (ISO 31000 / ISO 27005 / NIST), où ces suggestions sont proposées.
 */
export function stripEbiosCritere(intitule: string): string {
  return intitule.replace(/\s*\([CIDT]\)\s*$/, '').trim()
}

/** Exemples sectoriels (scénarios stratégiques puis événements redoutés) avec intitulé et notes suggérées. */
function exemplesBruts(secteur: string | null | undefined, sousSecteur: string | readonly string[] | null | undefined, patterns: readonly string[] | null | undefined, locale: Locale) {
  // Les patterns apportent du contenu même sans secteur (vision technique indépendante du métier).
  const hasPatterns = (patterns?.length ?? 0) > 0
  const scen = secteur || hasPatterns ? sectorExemplesFor(secteur, 'scenariosStrategiques', locale, sousSecteur, patterns) : []
  const evt = secteur || hasPatterns ? sectorExemplesFor(secteur, 'evenementsRedoutes', locale, sousSecteur, patterns) : []
  return [
    ...scen.map(x => ({
      ...x,
      _intitule: stripEbiosCritere(String(x.nom ?? x.description ?? '').trim()),
      _g: clamp1to4(x.graviteDefaut, V_DEFAULT),
      _v: clamp1to4(x.vraisemblanceDefaut, V_DEFAULT),
    })),
    ...evt.map(x => ({
      ...x,
      _intitule: stripEbiosCritere(String(x.description ?? '').trim()),
      _g: clamp1to4(x.graviteDefaut, V_DEFAULT),
      _v: V_DEFAULT,
    })),
  ].filter(x => x._intitule.length > 0)
}

/**
 * Suggestions de risques pour le secteur/sous-secteur de l'analyse. `[]` si le
 * secteur n'appartient à aucune famille connue. Déduplique par intitulé (insensible
 * à la casse), classe les plus pertinents en tête, borne la liste à `limit`.
 */
export function suggestRisqueExemples(opts: {
  secteur?: string | null
  sousSecteur?: string | readonly string[] | null
  /** Patterns d'architecture cochés : leurs scénarios et événements redoutés s'ajoutent à ceux du secteur. */
  patterns?: readonly string[] | null
  locale?: Locale
  limit?: number
  /** Socle de risques TRANSVERSES (tous secteurs), résolu i18n par la page.
   *  Toujours proposé — même sans secteur — pour ne jamais laisser l'écran vide. */
  base?: readonly { intitule: string; gravite: number; vraisemblance: number }[]
}): RisqueExemple[] {
  const { secteur, sousSecteur, patterns, locale = 'fr', limit = 12, base = [] } = opts

  const raw = exemplesBruts(secteur, sousSecteur, patterns, locale)

  // Classement : vocabulaire du sous-secteur principal (le premier choisi).
  const ranked = rankExemples(raw, { secteur, sousSecteur: Array.isArray(sousSecteur) ? (sousSecteur[0] ?? null) : (sousSecteur as string | null | undefined) })

  // Candidats : sectoriels (les plus pertinents en tête) PUIS socle transverse.
  // Le socle transverse est toujours proposé (pertinent=false) — jamais d'écran vide.
  const candidates: RisqueExemple[] = [
    ...ranked.map(r => ({ intitule: r._intitule, gravite: r._g, vraisemblance: r._v, pertinent: r.pertinent })),
    ...base.map(b => ({
      intitule: stripEbiosCritere(String(b.intitule ?? '').trim()),
      gravite: clamp1to4(b.gravite, V_DEFAULT),
      vraisemblance: clamp1to4(b.vraisemblance, V_DEFAULT),
      pertinent: false,
    })),
  ].filter(c => c.intitule.length > 0)

  const seen = new Set<string>()
  const out: RisqueExemple[] = []
  for (const c of candidates) {
    const key = c.intitule.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
    if (out.length >= limit) break
  }
  return out
}

// ─── Catalogue de risques types d'un projet (import en phase d'identification) ─
// Tous les risques proposables, groupés par origine et sans plafond : registre de l'organisation, propres aux
// sous-secteurs choisis (cas d'usage), propres aux patterns d'architecture cochés, communs au secteur, puis socle
// transverse. Deux sources : exemples EBIOS RM des packs sectoriels (domaine cyber, cotation suggérée) et risques du
// catalogue sectoriel GRC (secteur, patterns, transverses ; domaine déduit de la catégorie bâloise, cotation G2·V2 à
// revoir). Un intitulé n'apparaît qu'une fois (origine la plus spécifique) ; ceux déjà dans l'analyse sont signalés.
// Testé : risques-types.test.ts.

export { GROUPES_RISQUES_TYPES, type GroupeRisqueType, type RisqueType } from '@/lib/risques-types'

export function catalogueRisquesTypes(opts: {
  secteur?: string | null
  sousSecteur?: string | readonly string[] | null
  patterns?: readonly string[] | null
  locale?: Locale
  base?: readonly { intitule: string; gravite: number; vraisemblance: number }[]
  registre?: readonly { intitule: string; gravite: number; vraisemblance: number; domaine?: string }[]
  /** Intitulés déjà présents dans l'analyse. */
  existants?: readonly string[]
}): RisqueType[] {
  const { secteur, sousSecteur, patterns, locale = 'fr', base = [], registre = [], existants = [] } = opts
  const present = new Set(existants.map(x => x.trim().toLowerCase()))
  const groupeDe = (x: Record<string, unknown>): GroupeRisqueType => (x.pertinence === 'CAS_USAGE' ? 'SOUS_SECTEUR' : x.pertinence === 'ARCHITECTURE' ? 'ARCHITECTURE' : 'SECTEUR')
  const candidats: Omit<RisqueType, 'present'>[] = [
    ...registre.map(r => ({ groupe: 'REGISTRE' as const, intitule: r.intitule.trim(), gravite: r.gravite, vraisemblance: r.vraisemblance, ...(r.domaine ? { domaine: r.domaine } : {}) })),
    ...exemplesBruts(secteur, sousSecteur, patterns, locale).map(x => ({ groupe: groupeDe(x), intitule: x._intitule, gravite: x._g, vraisemblance: x._v, domaine: 'CYBER' })),
    ...risquesCatalogueGrc(secteur, sousSecteur, patterns, locale),
    ...base.map(b => ({ groupe: 'TRANSVERSE' as const, intitule: stripEbiosCritere(String(b.intitule ?? '').trim()), gravite: clamp1to4(b.gravite, V_DEFAULT), vraisemblance: clamp1to4(b.vraisemblance, V_DEFAULT), domaine: 'CYBER' })),
  ]
  const rang = (g: GroupeRisqueType) => GROUPES_RISQUES_TYPES.indexOf(g)
  const vus = new Set<string>()
  return candidats
    .filter(c => c.intitule.length > 0)
    .map((c, idx) => ({ c, idx }))
    .sort((a, b) => rang(a.c.groupe) - rang(b.c.groupe) || a.idx - b.idx)
    .flatMap(({ c }) => {
      const cle = c.intitule.toLowerCase()
      if (vus.has(cle)) return []
      vus.add(cle)
      return [{ ...c, present: present.has(cle) }]
    })
}

/** Risques du catalogue retenus pour l'import : demandés (par intitulé), pas déjà présents, sans doublon. */
export function selectionRisquesTypes(catalogue: readonly RisqueType[], demandes: readonly unknown[]): RisqueType[] {
  const voulu = new Set(demandes.filter((x): x is string => typeof x === 'string').map(x => x.trim().toLowerCase()))
  return catalogue.filter(r => !r.present && voulu.has(r.intitule.toLowerCase()))
}

/** Risques du catalogue sectoriel GRC pour le secteur (et l'assurance selon le sous-secteur) et les patterns cochés. */
function risquesCatalogueGrc(secteur: string | null | undefined, sousSecteur: string | readonly string[] | null | undefined, patterns: readonly string[] | null | undefined, locale: Locale): Omit<RisqueType, 'present'>[] {
  const ss = Array.isArray(sousSecteur) ? sousSecteur : typeof sousSecteur === 'string' ? [sousSecteur] : []
  return listSectorSuggestions(codesCatalogueSecteur(secteur, ss), locale, patterns).flatMap(item => {
    if (item.kind !== 'RISK') return []
    const domaine = domaineFromTaxonomie(item.taxonomieCode)
    const groupe: GroupeRisqueType = item.patterns?.length ? 'ARCHITECTURE' : item.sector === 'TRANSVERSAL' ? 'TRANSVERSE' : 'SECTEUR'
    return [{ groupe, intitule: item.title.trim(), ...(item.description ? { description: item.description } : {}), gravite: V_DEFAULT, vraisemblance: V_DEFAULT, ...(domaine ? { domaine } : {}) }]
  })
}
