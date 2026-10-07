// ─── Indicateurs d'un projet 360 (page de présentation) — PUR ────────────────
// Pilotage du traitement : avancement des plans d'action (terminés / total), retards et échéances proches, plans
// incomplets (sans porteur, sans échéance), risques à traiter sans aucun plan, réduction du niveau de risque brut →
// résiduel et risques résiduels encore au-dessus de l'appétit ; date de mise en service : jours restants et plans
// ouverts prévus après elle. Testé : projet-indicateurs.test.ts.
import { cotations } from '@/lib/cotation-risque'
import { evaluateRisk, type EvaluationContext } from '@/lib/risque-priorisation'
import type { RisqueSynthese } from '@/lib/projet-synthese'

export interface PlanIndicateur { statut: string; echeance: Date | null; porteur: string | null; risqueIds: string[] }

export interface IndicateursProjet {
  plans: { total: number; faits: number; enCours: number; aFaire: number; avancement: number | null
    enRetard: number; echeanceProche: number; sansPorteur: number; sansEcheance: number }
  risquesATraiterSansPlan: number
  reductionPct: number | null
  residuelsHorsAppetit: number
  /** Date de mise en service du projet (Analyse.dateEcheance) : jours restants (négatif si passée), plans ouverts après. */
  miseEnService: { joursRestants: number; plansApres: number } | null
}

const JOUR = 86_400_000
/** Horizon d'une échéance « proche » (jours). */
export const ECHEANCE_PROCHE_JOURS = 30

export function indicateursProjet({ risques, plans, ctx, now, miseEnService = null }: {
  risques: readonly RisqueSynthese[]; plans: readonly PlanIndicateur[]; ctx: EvaluationContext; now: Date; miseEnService?: Date | null
}): IndicateursProjet {
  const ouverts = plans.filter(p => p.statut !== 'FAIT')
  const t = now.getTime()
  const faits = plans.length - ouverts.length
  const couverts = new Set(plans.flatMap(p => p.risqueIds))

  let brut = 0, residuel = 0, aTraiterSansPlan = 0, horsAppetit = 0
  for (const r of risques) {
    const c = cotations(r)
    brut += c.brut.g * c.brut.v
    residuel += c.residuel.g * c.residuel.v
    if (evaluateRisk(r, ctx).decision === 'treat' && !couverts.has(r.id)) aTraiterSansPlan++
    const res = { ...r, graviteActuelle: c.residuel.g, vraisemblanceActuelle: c.residuel.v, niveauActuel: c.residuel.g * c.residuel.v }
    if (evaluateRisk(res, ctx).decision === 'treat') horsAppetit++
  }

  return {
    plans: {
      total: plans.length,
      faits,
      enCours: plans.filter(p => p.statut === 'EN_COURS').length,
      aFaire: plans.filter(p => p.statut === 'A_FAIRE').length,
      avancement: plans.length ? Math.round((faits / plans.length) * 100) : null,
      enRetard: ouverts.filter(p => p.echeance && p.echeance.getTime() < t).length,
      echeanceProche: ouverts.filter(p => p.echeance && p.echeance.getTime() >= t && p.echeance.getTime() <= t + ECHEANCE_PROCHE_JOURS * JOUR).length,
      sansPorteur: ouverts.filter(p => !p.porteur?.trim()).length,
      sansEcheance: ouverts.filter(p => !p.echeance).length,
    },
    risquesATraiterSansPlan: aTraiterSansPlan,
    reductionPct: brut > 0 ? Math.round((1 - residuel / brut) * 100) : null,
    residuelsHorsAppetit: horsAppetit,
    miseEnService: miseEnService ? {
      joursRestants: Math.round((miseEnService.getTime() - t) / JOUR),
      plansApres: ouverts.filter(p => p.echeance && p.echeance.getTime() > miseEnService.getTime()).length,
    } : null,
  }
}
