// ─── Priorisation & décision d'acceptation (phase Évaluation) — module PUR ───
// Étape « Évaluation des risques » (ISO/IEC 27005) / « Communicate » (NIST) : on
// compare les niveaux de risque aux critères d'acceptation pour décider lesquels
// traiter. Le critère d'acceptation est porté par la MATRICE / les paliers
// (`getRiskTier`, configurés par l'ADMIN) : élevé/critique = à traiter, faible/
// modéré = acceptable. Module pur (aucun accès DB) → testé unitairement.

import { getRiskTier } from '@/lib/risk-scale'

/** Décision d'évaluation : traiter le risque ou l'accepter en l'état. */
export type Decision = 'treat' | 'accept'

/** Décision d'acceptation d'un niveau de risque selon les paliers (élevé/critique = à traiter). */
export function acceptanceDecision(niveau: number): Decision {
  const tier = getRiskTier(niveau)
  return tier === 'eleve' || tier === 'critique' ? 'treat' : 'accept'
}

/** Ligne priorisable (au minimum son niveau de risque). */
export interface PrioRow {
  niveauRisque: number
}

/** Trie les risques par niveau DÉCROISSANT (priorité) et annote la décision. Non destructif. */
export function prioritise<T extends PrioRow>(rows: T[]): { row: T; decision: Decision }[] {
  return [...rows]
    .sort((a, b) => b.niveauRisque - a.niveauRisque)
    .map(row => ({ row, decision: acceptanceDecision(row.niveauRisque) }))
}

/** Compte les risques à traiter vs acceptables. */
export function countDecisions(rows: PrioRow[]): { treat: number; accept: number } {
  let treat = 0, accept = 0
  for (const r of rows) acceptanceDecision(r.niveauRisque) === 'treat' ? treat++ : accept++
  return { treat, accept }
}
