/**
 * exemples-ateliers.ts — Registre des exemples par défaut des ateliers, rendus
 * éditables via /configuration (section « Exemples des ateliers »).
 *
 * Modèle « remplace les défauts » : si une catégorie possède un override
 * (tableau non vide stocké dans OrganizationConfig.exemplesAteliers), il est
 * utilisé tel quel par les ateliers ; sinon on retombe sur les défauts
 * (traduits via i18n) de `ebios-data`.
 *
 * Schema-driven : chaque catégorie déclare ses champs, ce qui permet à
 * l'éditeur générique (UI) et au sanitizer (API) de fonctionner sans code
 * spécifique par catégorie. Les catégories des ateliers 2 à 5 seront ajoutées
 * par lots successifs.
 */

export const SCORE_MIN = 1
export const SCORE_MAX = 5
const SCORE_DEFAULT = 3

export type FieldKind = 'text' | 'longtext' | 'enum' | 'score' | 'stringList'

export interface FieldSchema {
  /** Clé de la propriété dans l'objet exemple. */
  key: string
  /** Type de champ — pilote la validation et le rendu de l'éditeur. */
  kind: FieldKind
  /** Longueur max (text/longtext) ou nb max d'éléments (stringList). */
  max?: number
  /** Longueur max d'un élément de liste (stringList). */
  itemMax?: number
  /** Valeurs autorisées (enum) — la première sert de repli. */
  options?: readonly string[]
}

export type ExempleCategoryKey =
  | 'valeursMetier'
  | 'biensSupports'
  | 'evenementsRedoutes'
  | 'sourcesRisque'
  | 'objectifsVises'
  | 'scenariosStrategiques'
  | 'partiesPrenantes'
  | 'actionsElementaires'
  | 'mesuresEcosysteme'

export interface CategoryDef {
  key: ExempleCategoryKey
  /** Numéro d'atelier (1..5). */
  atelier: number
  /** Champ obligatoire : une ligne dont ce champ est vide est supprimée. */
  primary: string
  /** Libellé FR par défaut (l'UI privilégie la clé i18n correspondante). */
  labelDefault: string
  fields: FieldSchema[]
}

const TYPES_VALEUR_METIER = ['PROCESSUS', 'INFORMATION'] as const
const TYPES_BIEN_SUPPORT = [
  'MATERIEL', 'LOGICIEL', 'RESEAU', 'DONNEES',
  'PERSONNEL', 'SITE', 'ORGANISATION', 'SOUS_TRAITANCE',
] as const
const CATEGORIES_SOURCE = [
  'CYBERCRIMINEL', 'ETAT_NATION', 'CONCURRENT', 'ACTIVISTE',
  'EMPLOYE_MALVEILLANT', 'PRESTATAIRE', 'AMATEUR', 'TERRORISTE', 'AUTRE',
] as const
const CRITERES_DICT = ['D', 'I', 'C', 'T'] as const
const TYPES_PARTIE_PRENANTE = ['PRESTATAIRE', 'FOURNISSEUR', 'CLIENT', 'PARTENAIRE', 'SOUS_TRAITANT', 'ORGANISME_REGULATION', 'AUTRE'] as const
const TYPES_ACTION = [
  'RECONNAISSANCE', 'ACCES_INITIAL', 'PERSISTANCE', 'ESCALADE_PRIVILEGES',
  'MOUVEMENT_LATERAL', 'EXFILTRATION', 'IMPACT',
] as const
const TYPES_MESURE = ['ORGANISATIONNELLE', 'TECHNIQUE', 'DETECTIVE', 'PHYSIQUE'] as const

export const EXEMPLES_CATEGORIES: CategoryDef[] = [
  {
    key: 'valeursMetier',
    atelier: 1,
    primary: 'nom',
    labelDefault: 'Valeurs métier',
    fields: [
      { key: 'nom', kind: 'text', max: 120 },
      { key: 'type', kind: 'enum', options: TYPES_VALEUR_METIER },
      { key: 'description', kind: 'longtext', max: 400 },
      { key: 'disponibilite', kind: 'score' },
      { key: 'integrite', kind: 'score' },
      { key: 'confidentialite', kind: 'score' },
      { key: 'tracabilite', kind: 'score' },
    ],
  },
  {
    key: 'biensSupports',
    atelier: 1,
    primary: 'nom',
    labelDefault: 'Biens supports',
    fields: [
      { key: 'nom', kind: 'text', max: 120 },
      { key: 'type', kind: 'enum', options: TYPES_BIEN_SUPPORT },
      { key: 'description', kind: 'longtext', max: 400 },
    ],
  },
  {
    key: 'evenementsRedoutes',
    atelier: 1,
    primary: 'description',
    labelDefault: 'Événements redoutés',
    fields: [
      { key: 'description', kind: 'longtext', max: 240 },
      { key: 'impacts', kind: 'stringList', max: 12, itemMax: 160 },
      { key: 'graviteDefaut', kind: 'score' },
    ],
  },
  // ── Atelier 2 ──────────────────────────────────────────────────────────────
  {
    key: 'sourcesRisque',
    atelier: 2,
    primary: 'nom',
    labelDefault: 'Sources de risque',
    fields: [
      { key: 'nom', kind: 'text', max: 120 },
      { key: 'categorie', kind: 'enum', options: CATEGORIES_SOURCE },
      { key: 'description', kind: 'longtext', max: 400 },
      { key: 'motivation', kind: 'text', max: 200 },
      { key: 'ressources', kind: 'text', max: 200 },
      { key: 'pertinenceDefaut', kind: 'score' },
    ],
  },
  {
    key: 'objectifsVises',
    atelier: 2,
    primary: 'nom',
    labelDefault: 'Objectifs visés',
    fields: [
      { key: 'nom', kind: 'text', max: 150 },
      { key: 'description', kind: 'longtext', max: 400 },
    ],
  },
  // ── Atelier 3 ──────────────────────────────────────────────────────────────
  {
    key: 'scenariosStrategiques',
    atelier: 3,
    primary: 'nom',
    labelDefault: 'Scénarios stratégiques',
    fields: [
      { key: 'critere', kind: 'enum', options: CRITERES_DICT },
      { key: 'nom', kind: 'text', max: 160 },
      { key: 'description', kind: 'longtext', max: 500 },
      { key: 'vraisemblanceDefaut', kind: 'score' },
      { key: 'graviteDefaut', kind: 'score' },
    ],
  },
  {
    key: 'partiesPrenantes',
    atelier: 3,
    primary: 'nom',
    labelDefault: 'Parties prenantes',
    fields: [
      { key: 'nom', kind: 'text', max: 120 },
      { key: 'type', kind: 'enum', options: TYPES_PARTIE_PRENANTE },
      { key: 'exposition', kind: 'score' },
      { key: 'fiabilite', kind: 'score' },
    ],
  },
  // ── Atelier 4 ──────────────────────────────────────────────────────────────
  {
    key: 'actionsElementaires',
    atelier: 4,
    primary: 'nom',
    labelDefault: 'Actions élémentaires',
    fields: [
      { key: 'type', kind: 'enum', options: TYPES_ACTION },
      { key: 'nom', kind: 'text', max: 160 },
      { key: 'description', kind: 'longtext', max: 400 },
    ],
  },
  {
    key: 'mesuresEcosysteme',
    atelier: 3,
    primary: 'mesure',
    labelDefault: 'Mesures d’écosystème',
    fields: [
      { key: 'mesure', kind: 'text', max: 160 },
      { key: 'type', kind: 'enum', options: TYPES_MESURE },
      { key: 'iso27005', kind: 'text', max: 20 },
      { key: 'description', kind: 'longtext', max: 400 },
    ],
  },
]

const BY_KEY = new Map(EXEMPLES_CATEGORIES.map((c) => [c.key, c]))

export function getCategoryDef(key: ExempleCategoryKey): CategoryDef | undefined {
  return BY_KEY.get(key)
}

function clampScore(v: unknown): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return SCORE_DEFAULT
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, n))
}

function sanitizeField(field: FieldSchema, raw: unknown): unknown {
  switch (field.kind) {
    case 'text':
    case 'longtext':
      return String(raw ?? '').trim().slice(0, field.max ?? 200)
    case 'enum': {
      const opts = field.options ?? []
      const v = String(raw ?? '')
      return opts.includes(v) ? v : (opts[0] ?? '')
    }
    case 'score':
      return clampScore(raw)
    case 'stringList': {
      if (!Array.isArray(raw)) return []
      return raw
        .map((x) => String(x ?? '').trim().slice(0, field.itemMax ?? 160))
        .filter(Boolean)
        .slice(0, field.max ?? 20)
    }
    default:
      return undefined
  }
}

/** Nb max de lignes conservées par catégorie. */
export const MAX_EXEMPLES = 100

/**
 * Nettoie et valide un tableau d'exemples pour une catégorie donnée.
 * Lignes dont le champ `primary` est vide → supprimées. Catégorie inconnue ou
 * entrée non-tableau → `[]`.
 */
export function sanitizeExemples(
  key: ExempleCategoryKey,
  rawArray: unknown[],
): Record<string, unknown>[] {
  const def = BY_KEY.get(key)
  if (!def || !Array.isArray(rawArray)) return []
  const out: Record<string, unknown>[] = []
  for (const raw of rawArray.slice(0, MAX_EXEMPLES)) {
    if (raw == null || typeof raw !== 'object') continue
    const row: Record<string, unknown> = {}
    for (const field of def.fields) {
      row[field.key] = sanitizeField(field, (raw as Record<string, unknown>)[field.key])
    }
    if (!String(row[def.primary] ?? '').trim()) continue
    out.push(row)
  }
  return out
}

/**
 * Repli sur les défauts : renvoie l'override s'il s'agit d'un tableau non vide,
 * sinon le tableau de défauts (référence inchangée).
 */
export function resolveExemples<T>(
  override: T[] | null | undefined,
  defaults: T[],
): T[] {
  return Array.isArray(override) && override.length > 0 ? override : defaults
}
