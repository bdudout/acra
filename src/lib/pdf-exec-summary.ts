/**
 * pdf-exec-summary.ts — Logique du résumé exécutif non technique du rapport PDF
 * (issue #76). Extraite du template pour être testable (le template est compilé
 * à part par esbuild). Pur.
 */
import { getRiskTier } from '@/lib/risk-scale'

export type ExecLevel = 'high' | 'medium' | 'low' | 'none'

/** Niveau de risque global non technique : pire cas des risques évalués. */
export function execGlobalLevel(risques?: { niveauRisque: number }[]): ExecLevel {
  const list = risques ?? []
  if (list.length === 0) return 'none'
  if (list.some(r => getRiskTier(r.niveauRisque) === 'critique')) return 'high'
  if (list.some(r => getRiskTier(r.niveauRisque) === 'eleve')) return 'medium'
  return 'low'
}

/** Les N risques les plus élevés (score brut décroissant). */
export function execTopRisks<T extends { niveauRisque: number }>(risques?: T[], n = 3): T[] {
  return [...(risques ?? [])].sort((a, b) => b.niveauRisque - a.niveauRisque).slice(0, n)
}

/**
 * Les N premières mesures à engager : non réalisées d'abord, triées par priorité
 * croissante. Repli sur les N premières mesures si toutes sont réalisées.
 */
export function execMeasuresToEngage<T extends { statut?: string; priorite?: number }>(mesures?: T[], n = 5): T[] {
  const list = mesures ?? []
  const aEngager = list
    .filter(m => m.statut !== 'REALISE')
    .sort((a, b) => (a.priorite ?? 9) - (b.priorite ?? 9))
    .slice(0, n)
  return aEngager.length > 0 ? aEngager : list.slice(0, n)
}
