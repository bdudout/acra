// ─── Acceptation des risques résiduels : résumé et préconditions ───────────────
// Recette n° 56 : la décision de la Direction métier porte sur un livrable lisible (risques
// résiduels par niveau, non cotés) et n'est possible que sur une analyse soumise ou approuvée
// dont tous les risques sont cotés. Même règle pour la route et pour le panneau.
import { getRiskTier, type RiskTier } from '@/lib/risk-scale'

export interface ResumeRisquesResiduels {
  total: number
  parNiveau: Record<RiskTier, number>
  /** Risques sans niveau résiduel évalué. */
  nonCotes: number
}

export type MotifBlocageAcceptation = 'ANALYSE_NON_SOUMISE' | 'RISQUES_NON_COTES'

/** Statuts d'analyse sur lesquels la décision d'acceptation (ou de refus) est possible. */
export const STATUTS_ACCEPTATION = ['SOUMIS', 'APPROUVE'] as const

export function resumeRisquesResiduels(risques: { niveauResiduel: number | null }[]): ResumeRisquesResiduels {
  const parNiveau: Record<RiskTier, number> = { critique: 0, eleve: 0, modere: 0, faible: 0 }
  let nonCotes = 0
  for (const r of risques) {
    if (r.niveauResiduel == null) nonCotes++
    else parNiveau[getRiskTier(r.niveauResiduel)]++
  }
  return { total: risques.length, parNiveau, nonCotes }
}

/** Motif qui interdit d'accepter ou de refuser les risques résiduels ; null si la décision est possible. */
export function motifBlocageAcceptation(statutAnalyse: string, resume: ResumeRisquesResiduels): MotifBlocageAcceptation | null {
  if (!(STATUTS_ACCEPTATION as readonly string[]).includes(statutAnalyse)) return 'ANALYSE_NON_SOUMISE'
  if (resume.nonCotes > 0) return 'RISQUES_NON_COTES'
  return null
}
