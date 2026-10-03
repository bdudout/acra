/**
 * exemples-patterns.ts — Contenu des patterns d'architecture de SI et sélection (lots A2/A3 de
 * docs/specs/patterns-architecture-besoins.md).
 *
 * Un élément porte la liste des patterns qui l'activent : TOUS doivent être cochés (combinaisons, BE-5). Le contenu est
 * formulé de façon générique, valable pour tout secteur ; `familles` restreint un élément à certaines familles de
 * secteur (variantes sectorielles, BE-4). Les textes sont écrits dans les 5 langues DANS la donnée (tuples
 * fr/en/de/es/it) : ajouter ou retirer un élément ne décale aucune traduction. Contenu « à relire par un expert » :
 * suggestions à qualifier. Module pur → testé (exemples-patterns*.test.ts).
 */
import type { Locale } from '@/lib/i18n'
import type { SecteurFamille } from '@/lib/sous-secteurs'

export type Tr = readonly [fr: string, en: string, de: string, es: string, it: string]
export type PatternCategory =
  | 'valeursMetier' | 'biensSupports' | 'evenementsRedoutes' | 'sourcesRisque' | 'scenariosStrategiques'
  | 'partiesPrenantes' | 'actionsElementaires' | 'mesuresEcosysteme' | 'mesures'

export interface PatternItem {
  category: PatternCategory
  /** Patterns requis : tous doivent être cochés pour que l'élément soit proposé. */
  patterns: readonly string[]
  /** Variante sectorielle : seules ces familles de secteur voient l'élément (absent = tous secteurs). */
  familles?: readonly SecteurFamille[]
  /** Champs : chaînes / nombres conservés tels quels ; `Tr` localisé ; `Tr[]` localisé élément par élément. */
  data: Record<string, unknown>
}

export const L = (fr: string, en: string, de: string, es: string, it: string): Tr => [fr, en, de, es, it]
const isTr = (v: unknown): v is Tr => Array.isArray(v) && v.length === 5 && v.every(x => typeof x === 'string')
const IDX: Record<Locale, number> = { fr: 0, en: 1, de: 2, es: 3, it: 4 }

// ─── Constructeurs compacts (mêmes champs que les packs sectoriels) ───────────────────────────────
type Pats = readonly string[]
const mk = (patterns: Pats, category: PatternCategory, data: Record<string, unknown>): PatternItem => ({ category, patterns, data })
export const vm = (p: Pats, nom: Tr, type: 'PROCESSUS' | 'INFORMATION', description: Tr, responsable: Tr, d: number, i: number, c: number, t: number) =>
  mk(p, 'valeursMetier', { nom, type, description, responsable, disponibilite: d, integrite: i, confidentialite: c, tracabilite: t })
export const bs = (p: Pats, nom: Tr, type: 'MATERIEL' | 'LOGICIEL' | 'RESEAU' | 'DONNEES' | 'PERSONNEL' | 'SITE' | 'ORGANISATION' | 'SOUS_TRAITANCE', description: Tr) =>
  mk(p, 'biensSupports', { nom, type, description })
export const er = (p: Pats, description: Tr, impacts: Tr[], graviteDefaut: number) => mk(p, 'evenementsRedoutes', { description, impacts, graviteDefaut })
export const sr = (p: Pats, nom: Tr, categorie: string, description: Tr, motivation: Tr, ressources: Tr, pertinenceDefaut: number) =>
  mk(p, 'sourcesRisque', { nom, categorie, description, motivation, ressources, pertinenceDefaut })
export const ss = (p: Pats, critere: 'C' | 'I' | 'D' | 'T', nom: Tr, description: Tr, vraisemblanceDefaut: number, graviteDefaut: number) =>
  mk(p, 'scenariosStrategiques', { critere, nom, description, vraisemblanceDefaut, graviteDefaut })
export const pp = (p: Pats, nom: Tr, type: string, dependance: number, penetration: number, maturite: number, confiance: number) =>
  mk(p, 'partiesPrenantes', { nom, type, dependance, penetration, maturite, confiance })
export const ae = (p: Pats, type: string, attack: string, nom: Tr, description: Tr) => mk(p, 'actionsElementaires', { type, attack, nom, description })
export const me = (p: Pats, mesure: Tr, type: 'ORGANISATIONNELLE' | 'TECHNIQUE' | 'DETECTIVE' | 'PHYSIQUE', iso27005: string, description: Tr) =>
  mk(p, 'mesuresEcosysteme', { mesure, type, iso27005, description })
type TypeMesure = 'PREVENTIVE' | 'DETECTIVE' | 'CORRECTIVE' | 'DISSUASIVE' | 'ORGANISATIONNELLE' | 'TECHNIQUE'
type CatEbios = 'GOUVERNANCE' | 'PROTECTION' | 'DEFENSE' | 'RESILIENCE'
export const ms = (p: Pats, nom: Tr, description: Tr, type: TypeMesure, categorieEbios: CatEbios, prioriteDefaut: 1 | 2 | 3 | 4, references?: string[]) =>
  mk(p, 'mesures', { nom, description, type, categorieEbios, prioriteDefaut, ...(references ? { references } : {}) })
/** Restreint un élément à certaines familles de secteur (variante sectorielle). */
export const only = (item: PatternItem, ...familles: SecteurFamille[]): PatternItem => ({ ...item, familles })

/**
 * Éléments à proposer pour les patterns cochés, une catégorie et la famille du secteur (ou null). Ordre : éléments d'un
 * SEUL pattern, dans l'ordre de la sélection ; puis les combinaisons (plusieurs patterns requis), dans l'ordre du contenu.
 * Un élément n'apparaît que si TOUS ses patterns sont cochés ; un pattern non coché n'apporte rien.
 */
export function selectPatternItems(items: readonly PatternItem[], checked: readonly string[], category: PatternCategory, famille: SecteurFamille | null): PatternItem[] {
  if (!checked.length) return []
  const on = new Set(checked)
  const visible = items.filter(i => i.category === category
    && i.patterns.length > 0 && i.patterns.every(p => on.has(p))
    && (!i.familles || (famille !== null && i.familles.includes(famille))))
  const single = checked.flatMap(code => visible.filter(i => i.patterns.length === 1 && i.patterns[0] === code))
  const combos = visible.filter(i => i.patterns.length > 1)
  return [...single, ...combos]
}

/** Localise un élément (tuples → chaînes). Les champs d'énumération ne sont jamais traduits. */
export function localizePatternItem(item: PatternItem, locale: Locale): Record<string, unknown> {
  const i = IDX[locale] ?? 0
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(item.data)) {
    if (isTr(v)) out[k] = v[i]
    else if (Array.isArray(v) && v.length && v.every(isTr)) out[k] = (v as Tr[]).map(t => t[i])
    else out[k] = v
  }
  return out
}

