// ─── Plans d'action restants d'un projet 360 (graphique « reste à faire ») — PUR ─
// Prévu : nombre de plans restant à réaliser après chaque jalon (échéance des plans ; un plan sans échéance reste
// jusqu'au bout) ; cible : ligne droite du total au début jusqu'à zéro à la mise en service (à défaut, au dernier
// jalon) ; aujourd'hui : plans réellement restants (non terminés). Testé : projet-burndown.test.ts.

export interface PlanJalon { statut: string; echeance: Date | null }
export interface PointRestants { date: Date; restants: number }

export function burndownPlans({ plans, debut, miseEnService, now }: { plans: readonly PlanJalon[]; debut: Date; miseEnService: Date | null; now: Date }) {
  if (plans.length === 0) return null
  const total = plans.length
  const jalons = [...new Set(plans.flatMap(p => (p.echeance ? [p.echeance.getTime()] : [])))].sort((a, b) => a - b)
  const prevu: PointRestants[] = [{ date: debut, restants: total }]
  for (const t of jalons) prevu.push({ date: new Date(t), restants: plans.filter(p => !p.echeance || p.echeance.getTime() > t).length })
  const fin = miseEnService ?? (jalons.length ? new Date(jalons[jalons.length - 1]) : now)
  return {
    total, prevu, fin,
    cible: [{ date: debut, restants: total }, { date: fin, restants: 0 }],
    aujourdhui: { date: now, restants: plans.filter(p => p.statut !== 'FAIT').length },
  }
}
export type BurndownPlans = NonNullable<ReturnType<typeof burndownPlans>>
