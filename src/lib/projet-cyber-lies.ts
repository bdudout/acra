// ─── Analyses cyber liées à un projet 360 : risques à traiter non importés — PUR ─
// Pour chaque analyse cyber rattachée au projet (Analyse.projetSourceId) : nombre de risques « à traiter » au niveau
// actuel (critère de l'organisation : appétit, sinon échelle) qui ne sont pas encore importés dans le projet
// (Risque.sourceRisqueId), et les intitulés des plus élevés. Testé : projet-cyber-lies.test.ts.
import { evaluateRisk, evaluatedLevel, type EvaluableRisk, type EvaluationContext } from '@/lib/risque-priorisation'

export interface AnalyseLiee { id: string; nom: string; risques: (EvaluableRisk & { id: string; nom: string })[] }
export interface CyberLie { id: string; nom: string; aImporter: number; exemples: string[] }

export function cyberLiesNonImportes(analyses: readonly AnalyseLiee[], importes: readonly string[], ctx: EvaluationContext, maxExemples = 3): CyberLie[] {
  const deja = new Set(importes)
  return analyses.map(a => {
    const aTraiter = a.risques
      .filter(r => !deja.has(r.id) && evaluateRisk(r, ctx).decision === 'treat')
      .sort((x, y) => evaluatedLevel(y).niveau - evaluatedLevel(x).niveau)
    return { id: a.id, nom: a.nom, aImporter: aTraiter.length, exemples: aTraiter.slice(0, maxExemples).map(r => r.nom) }
  })
}
