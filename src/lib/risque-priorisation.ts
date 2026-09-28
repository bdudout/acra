// ─── Échelle et évaluation des risques à saisie directe — module PUR ─────────
// Méthodes ISO/IEC 27005:2022, ISO 31000:2018, NIST SP 800-30 Rev. 1.
//
// P1 — Critères de l'ORGANISATION : l'échelle (4 ou 5 niveaux), les paliers et la
// matrice qualitative configurés par l'ADMIN (`getEffectiveScaleConfig`, les mêmes
// que l'EBIOS RM) s'appliquent aussi aux méthodes directes.
//
// P2 — Évaluation (ISO 27005 §7.4, ISO 31000 §6.4.4) : on évalue le risque ANALYSÉ,
// c.-à-d. son niveau ACTUEL (avec les mesures existantes ; repli sur le brut), et on
// le compare au critère d'acceptation de l'organisation :
//  1. l'APPÉTIT au risque (seuil de la catégorie, sinon global — lib/appetit) :
//     niveau > seuil ⇒ à traiter ; niveau ≤ seuil ⇒ acceptable ;
//  2. à défaut d'appétit défini, l'ÉCHELLE : la moitié haute des paliers
//     configurés est à traiter (4 paliers : Élevé et Critique ; 5 : les deux plus hauts).

import { getRiskLevel, computeRiskScore, type ScaleConfig, type Seuil } from '@/lib/risk-scale'
import { seuilApplicable, type AppetitConfig } from '@/lib/appetit'

/** Décision d'évaluation : traiter le risque ou l'accepter en l'état. */
export type Decision = 'treat' | 'accept'
/** Critère ayant fondé la décision. */
export type DecisionBasis = 'APPETIT' | 'ECHELLE'

/** Contexte d'évaluation : critères de l'organisation. */
export interface EvaluationContext { scale: ScaleConfig; appetit: AppetitConfig }

/** Ligne évaluable : cotations brutes (+ actuelles si saisies) et catégorie. */
export interface EvaluableRisk {
  gravite: number; vraisemblance: number; niveauRisque: number
  graviteActuelle?: number | null; vraisemblanceActuelle?: number | null; niveauActuel?: number | null
  taxonomieCode?: string | null
}

/** Résultat d'évaluation d'un risque. */
export interface RiskEvaluation {
  decision: Decision
  basis: DecisionBasis
  /** Niveau évalué (actuel, sinon brut). */
  niveau: number
  /** Palier de l'échelle de l'organisation pour ce niveau (libellé + couleur). */
  seuil: Seuil
  /** Seuil d'appétit appliqué (si basis = APPETIT). */
  seuilAppetit?: number
}

/** Niveaux sélectionnables de l'échelle configurée (1..4 ou 1..5). */
export function scaleLevels(scale: ScaleConfig): number[] {
  return Array.from({ length: scale.nbNiveaux }, (_, i) => i + 1)
}

/** Cotation évaluée : ACTUELLE (mesures existantes), repli sur la brute. */
export function evaluatedLevel(r: EvaluableRisk): { gravite: number; vraisemblance: number; niveau: number } {
  const gravite = r.graviteActuelle ?? r.gravite
  const vraisemblance = r.vraisemblanceActuelle ?? r.vraisemblance
  return { gravite, vraisemblance, niveau: r.niveauActuel ?? computeRiskScore(gravite, vraisemblance) }
}

/** Palier de l'échelle de l'organisation pour un couple G × V (matrice qualitative incluse). */
export function scaleSeuil(gravite: number, vraisemblance: number, scale: ScaleConfig): Seuil {
  return getRiskLevel(gravite, vraisemblance, scale)
}

/** Vrai si le palier est dans la moitié haute des paliers configurés. */
function upperHalf(seuil: Seuil, scale: ScaleConfig): boolean {
  const sorted = [...scale.seuilsMatrice].sort((a, b) => a.scoreMin - b.scoreMin)
  const idx = sorted.findIndex(s => s.label === seuil.label && s.scoreMin === seuil.scoreMin)
  const i = idx >= 0 ? idx : sorted.findIndex(s => s.label === seuil.label)
  return i >= Math.ceil(sorted.length / 2)
}

/** Évalue un risque selon les critères de l'organisation (appétit, sinon échelle). */
export function evaluateRisk(r: EvaluableRisk, ctx: EvaluationContext): RiskEvaluation {
  const { gravite, vraisemblance, niveau } = evaluatedLevel(r)
  const seuil = scaleSeuil(gravite, vraisemblance, ctx.scale)
  const seuilAppetit = seuilApplicable(ctx.appetit, r.taxonomieCode)
  if (seuilAppetit != null) {
    return { decision: niveau > seuilAppetit ? 'treat' : 'accept', basis: 'APPETIT', niveau, seuil, seuilAppetit }
  }
  return { decision: upperHalf(seuil, ctx.scale) ? 'treat' : 'accept', basis: 'ECHELLE', niveau, seuil }
}

/** Trie les risques par niveau ÉVALUÉ décroissant et annote l'évaluation. Non destructif. */
export function prioritiseRisks<T extends EvaluableRisk>(rows: T[], ctx: EvaluationContext): { row: T; evaluation: RiskEvaluation }[] {
  return rows
    .map(row => ({ row, evaluation: evaluateRisk(row, ctx) }))
    .sort((a, b) => b.evaluation.niveau - a.evaluation.niveau)
}

/** Compte les risques à traiter vs acceptables. */
export function countRiskDecisions(rows: EvaluableRisk[], ctx: EvaluationContext): { treat: number; accept: number } {
  let treat = 0, accept = 0
  for (const r of rows) {
    if (evaluateRisk(r, ctx).decision === 'treat') treat++
    else accept++
  }
  return { treat, accept }
}
