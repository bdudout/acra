// ─── Registre d'information des prestataires tiers TIC (DORA art. 28) ─────────
// Registre des accords contractuels avec les prestataires de services TIC, tenu
// au niveau de l'entité et remis à l'autorité (templates ITS). Ce moteur PUR gère :
//   - la VALIDATION de complétude d'un arrangement (champs plus exigeants pour les
//     fonctions critiques/importantes) ;
//   - la SYNTHÈSE de pilotage : concentration par prestataire, part critique,
//     sous-traitance, contrats proches de l'expiration.
// Aide à la décision — ne vaut pas remise réglementaire. Logique testée.

export const TYPES_SERVICE_TIC = ['HEBERGEMENT', 'CLOUD', 'LOGICIEL', 'RESEAU', 'SECURITE', 'DONNEES', 'SUPPORT', 'AUTRE'] as const
export type TypeServiceTic = (typeof TYPES_SERVICE_TIC)[number]

/** Criticité de la FONCTION supportée par le service TIC (DORA). */
export const NIVEAUX_CRITICITE = ['CRITIQUE', 'IMPORTANTE', 'NON_CRITIQUE'] as const
export type NiveauCriticite = (typeof NIVEAUX_CRITICITE)[number]

export interface ArrangementTic {
  /** Référence de l'accord contractuel. */
  reference: string
  prestataireNom: string
  /** Identifiant du prestataire (LEI de préférence). */
  identifiant?: string | null
  /** Pays du prestataire (ISO). */
  pays?: string | null
  typeService: TypeServiceTic
  /** Fonction (métier) supportée par le service. */
  fonctionSupportee?: string | null
  /** Criticité de la fonction supportée. */
  criticite: NiveauCriticite
  dateDebut?: Date | string | null
  dateFin?: Date | string | null
  /** Pays de stockage/traitement des données. */
  paysDonnees?: string | null
  /** L'arrangement implique-t-il une chaîne de sous-traitance TIC ? */
  sousTraitance?: boolean
}

const rempli = (v: unknown): boolean => {
  if (v == null) return false
  if (typeof v === 'string') return v.trim().length > 0
  return true
}

const estCritiqueOuImportante = (c: NiveauCriticite): boolean => c === 'CRITIQUE' || c === 'IMPORTANTE'

/**
 * Champs manquants/invalides d'un arrangement (tableau vide = complet).
 * Base : référence, prestataire, type de service, criticité. Une fonction
 * critique/importante exige EN PLUS l'identifiant, le pays, la fonction et la date
 * de début (données requises par les ITS pour ces prestataires).
 */
export function validerArrangement(a: ArrangementTic): string[] {
  const manquants: string[] = []
  if (!rempli(a.reference)) manquants.push('reference')
  if (!rempli(a.prestataireNom)) manquants.push('prestataireNom')
  if (!TYPES_SERVICE_TIC.includes(a.typeService)) manquants.push('typeService')
  if (!NIVEAUX_CRITICITE.includes(a.criticite)) manquants.push('criticite')

  if (estCritiqueOuImportante(a.criticite)) {
    if (!rempli(a.identifiant)) manquants.push('identifiant')
    if (!rempli(a.pays)) manquants.push('pays')
    if (!rempli(a.fonctionSupportee)) manquants.push('fonctionSupportee')
    if (!rempli(a.dateDebut)) manquants.push('dateDebut')
  }
  return manquants
}

// ─── Entrée API : normalisation & validation ─────────────────────────────────

const TYPES_SET = new Set<string>(TYPES_SERVICE_TIC)
const NIVEAUX_SET = new Set<string>(NIVEAUX_CRITICITE)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
function toDate(v: unknown): Date | null {
  if (v == null || v === '') return null
  const d = v instanceof Date ? v : new Date(v as string)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Normalise un corps de requête en ArrangementTic (types/enums sûrs). */
export function cleanArrangementInput(body: unknown): ArrangementTic {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  return {
    reference: str(b.reference) ?? '',
    prestataireNom: str(b.prestataireNom) ?? '',
    identifiant: str(b.identifiant),
    pays: str(b.pays),
    typeService: TYPES_SET.has(String(b.typeService)) ? (b.typeService as TypeServiceTic) : 'AUTRE',
    fonctionSupportee: str(b.fonctionSupportee),
    criticite: NIVEAUX_SET.has(String(b.criticite)) ? (b.criticite as NiveauCriticite) : 'NON_CRITIQUE',
    dateDebut: toDate(b.dateDebut),
    dateFin: toDate(b.dateFin),
    paysDonnees: str(b.paysDonnees),
    sousTraitance: b.sousTraitance === true || b.sousTraitance === 'true',
  }
}

/**
 * Validation minimale à l'ENREGISTREMENT (brouillon autorisé incomplet) :
 * référence et prestataire requis, cohérence des dates. La complétude ITS
 * (champs des fonctions critiques) est mesurée à part par `validerArrangement`.
 * Renvoie un code d'erreur i18n ou null.
 */
export function validateArrangementInput(body: unknown): string | null {
  const a = cleanArrangementInput(body)
  if (!a.reference) return 'reference_requise'
  if (!a.prestataireNom) return 'prestataire_requis'
  const debut = toDate(a.dateDebut)
  const fin = toDate(a.dateFin)
  if (debut && fin && fin.getTime() < debut.getTime()) return 'dates_incoherentes'
  return null
}

export interface RegistreCompletude {
  total: number
  complets: number
  incomplets: number
  /** Part d'arrangements complets (0..1). */
  taux: number
}

export function evaluerCompletude(arrangements: ArrangementTic[]): RegistreCompletude {
  const total = arrangements.length
  const complets = arrangements.filter(a => validerArrangement(a).length === 0).length
  return { total, complets, incomplets: total - complets, taux: total ? complets / total : 1 }
}

export interface RegistreSynthese {
  arrangements: number
  /** Nombre de prestataires distincts (nom normalisé). */
  prestataires: number
  /** Arrangements supportant une fonction critique/importante. */
  critiques: number
  /** Arrangements avec chaîne de sous-traitance. */
  sousTraitance: number
  /** Prestataire le plus présent et sa part des arrangements, ou null. */
  concentrationTop: { prestataire: string; part: number } | null
  /** Contrats dont la date de fin tombe dans la fenêtre à venir. */
  expirentBientot: number
}

const J = 86_400_000

function parseDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Synthèse de pilotage du registre (concentration, criticité, expirations). */
export function synthetiserRegistre(
  arrangements: ArrangementTic[],
  opts: { maintenant?: Date; expirationJours?: number } = {},
): RegistreSynthese {
  const maintenant = opts.maintenant ?? new Date()
  const fenetre = (opts.expirationJours ?? 90) * J

  const critiques = arrangements.filter(a => estCritiqueOuImportante(a.criticite)).length
  const sousTraitance = arrangements.filter(a => a.sousTraitance === true).length

  // Regroupement par prestataire normalisé (casse/espaces), en gardant un libellé.
  const parPrestataire = new Map<string, { label: string; n: number }>()
  for (const a of arrangements) {
    const key = (a.prestataireNom ?? '').trim().toLowerCase()
    if (!key) continue
    const cur = parPrestataire.get(key)
    if (cur) cur.n++
    else parPrestataire.set(key, { label: a.prestataireNom.trim(), n: 1 })
  }

  let topLabel: string | null = null
  let topN = 0
  for (const { label, n } of parPrestataire.values()) {
    if (n > topN) { topN = n; topLabel = label }
  }
  const top = topLabel && arrangements.length
    ? { prestataire: topLabel, part: topN / arrangements.length }
    : null

  const expirentBientot = arrangements.filter(a => {
    const fin = parseDate(a.dateFin)
    if (!fin) return false
    const dt = fin.getTime() - maintenant.getTime()
    return dt >= 0 && dt <= fenetre
  }).length

  return {
    arrangements: arrangements.length,
    prestataires: parPrestataire.size,
    critiques,
    sousTraitance,
    concentrationTop: top,
    expirentBientot,
  }
}
