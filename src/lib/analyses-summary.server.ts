// ─── Indicateurs de risque de la liste des analyses (agrégats SQL) ──────────
// Audit 2026-09-30 (T13) : la liste des analyses chargeait TOUS les risques et
// TOUTES les mesures de chaque analyse visible pour calculer 4 indicateurs dans le
// navigateur (coût et charge utile proportionnels au volume total). Les mêmes
// indicateurs sont calculés en base par 4 agrégats, quel que soit le volume.

import { prisma } from '@/lib/prisma'
import { RISK_TIER_THRESHOLDS } from '@/lib/risk-scale'

/** Indicateurs affichés sur une carte d'analyse. */
export interface AnalyseRiskSummary {
  /** Niveau de risque maximal (0 si aucun risque). */
  maxRisk: number
  /** Risques au palier « critique ». */
  critiques: number
  /** Risques dont la stratégie est « réduire ». */
  reduire: number
  /** Mesures de priorité 1 encore « à faire ». */
  p1AFaire: number
}

export const EMPTY_RISK_SUMMARY: AnalyseRiskSummary = { maxRisk: 0, critiques: 0, reduire: 0, p1AFaire: 0 }

/** Ajoute `riskSummary` à chaque analyse (4 requêtes groupées, indépendamment du nombre de risques). */
export async function withRiskSummary<T extends { id: string }>(analyses: T[]): Promise<(T & { riskSummary: AnalyseRiskSummary })[]> {
  const ids = analyses.map(a => a.id)
  if (ids.length === 0) return []
  const [max, critiques, reduire, p1] = await Promise.all([
    prisma.risque.groupBy({ by: ['analyseId'], where: { analyseId: { in: ids } }, _max: { niveauRisque: true } }),
    prisma.risque.groupBy({ by: ['analyseId'], where: { analyseId: { in: ids }, niveauRisque: { gte: RISK_TIER_THRESHOLDS.critique } }, _count: { _all: true } }),
    prisma.risque.groupBy({ by: ['analyseId'], where: { analyseId: { in: ids }, strategie: 'REDUIRE' }, _count: { _all: true } }),
    prisma.mesure.groupBy({ by: ['analyseId'], where: { analyseId: { in: ids }, priorite: 1, statut: 'A_FAIRE' }, _count: { _all: true } }),
  ])
  const byId = new Map<string, AnalyseRiskSummary>(ids.map(id => [id, { ...EMPTY_RISK_SUMMARY }]))
  for (const r of max) byId.get(r.analyseId)!.maxRisk = r._max.niveauRisque ?? 0
  for (const r of critiques) byId.get(r.analyseId)!.critiques = r._count._all
  for (const r of reduire) byId.get(r.analyseId)!.reduire = r._count._all
  for (const r of p1) byId.get(r.analyseId)!.p1AFaire = r._count._all
  return analyses.map(a => ({ ...a, riskSummary: byId.get(a.id)! }))
}
