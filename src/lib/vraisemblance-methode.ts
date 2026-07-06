/**
 * vraisemblance-methode.ts — Méthodes d'évaluation de la vraisemblance (Atelier 4).
 *
 * Exigence EXI_M4_07/10/11/14 du cahier des charges du label EBIOS Risk Manager
 * (ANSSI v3.1) : l'utilisateur choisit une méthode d'évaluation de la vraisemblance
 * appliquée à tous les scénarios opérationnels :
 *   - EXPRESSE : vraisemblance globale saisie directement sur le scénario ;
 *   - STANDARD : une probabilité de succès (1..4) par action élémentaire ;
 *   - AVANCEE  : probabilité de succès ET difficulté technique (1..4) par action.
 * Pour les méthodes standard/avancée, la vraisemblance globale est calculée à
 * partir de la cotation des actions élémentaires (algorithme documenté ci-dessous,
 * la valeur restant « forçable » manuellement côté UI — EXI_M4_16).
 *
 * Module pur → testé unitairement (vraisemblance-methode.test.ts).
 */

export const METHODES_VRAISEMBLANCE = ['EXPRESSE', 'STANDARD', 'AVANCEE'] as const
export type MethodeVraisemblance = typeof METHODES_VRAISEMBLANCE[number]

/** Méthode par défaut. */
export const DEFAULT_METHODE: MethodeVraisemblance = 'EXPRESSE'

/** Normalise une valeur arbitraire vers une méthode connue ; défaut « expresse ». */
export function normalizeMethode(v: unknown): MethodeVraisemblance {
  const value = String(v ?? '').toUpperCase()
  return (METHODES_VRAISEMBLANCE as readonly string[]).includes(value)
    ? (value as MethodeVraisemblance)
    : DEFAULT_METHODE
}

function score(v: unknown, def: number): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return def
  return Math.min(4, Math.max(1, n))
}

function clamp1to4(n: number): number {
  return Math.min(4, Math.max(1, n))
}

interface ActionCotation {
  probabiliteSucces?: unknown
  difficulteTechnique?: unknown
}

/**
 * Calcule la vraisemblance globale d'un scénario opérationnel à partir de la
 * cotation de ses actions élémentaires.
 *
 * Algorithme ACRA (EXI_M4_14) :
 *   - STANDARD : moyenne des probabilités de succès (défaut 2), arrondie, bornée 1..4 ;
 *   - AVANCEE  : moyenne des probabilités pénalisée par la difficulté technique
 *     moyenne (pénalité = (difficulté moyenne − 1) × 0,5), arrondie, bornée 1..4.
 *
 * Renvoie `null` pour la méthode EXPRESSE (vraisemblance saisie manuellement) ou
 * en l'absence d'action à agréger.
 */
export function aggregateVraisemblance(
  actions: ActionCotation[] | null | undefined,
  methode: MethodeVraisemblance,
): number | null {
  const m = normalizeMethode(methode)
  if (m === 'EXPRESSE') return null
  if (!Array.isArray(actions) || actions.length === 0) return null

  const probs = actions.map(a => score(a?.probabiliteSucces, 2))
  const meanProb = probs.reduce((s, p) => s + p, 0) / probs.length

  if (m === 'STANDARD') {
    return clamp1to4(Math.round(meanProb))
  }

  // AVANCEE : pénalité liée à la difficulté technique moyenne.
  const diffs = actions.map(a => score(a?.difficulteTechnique, 2))
  const meanDiff = diffs.reduce((s, d) => s + d, 0) / diffs.length
  const penalty = (meanDiff - 1) * 0.5
  return clamp1to4(Math.round(meanProb - penalty))
}
