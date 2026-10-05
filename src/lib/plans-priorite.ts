// ─── Plans d'action d'un projet, par priorité (PUR) ───────────────────────────
// Phase « Traitement » d'un projet 360 : on traite d'abord ce qui réduit les risques les plus élevés. Ordre : plans
// ouverts avant les plans faits ; niveau du risque lié le plus élevé ; priorité du plan ; échéance (retards en tête).
// Testé : plans-priorite.test.ts.

export interface PlanProjet {
  id: string; titre: string; statut: string; priorite: string; echeance: string | Date | null; porteur: string | null
  risques: { id: string; nom: string; niveau: number }[]
}
const RANG_PRIORITE: Record<string, number> = { CRITIQUE: 0, MAJEUR: 1, MODERE: 2 }

export function trierPlansParPriorite<T extends PlanProjet>(plans: readonly T[], now: Date): (T & { niveauMax: number; enRetard: boolean })[] {
  return plans
    .map(p => {
      const ech = p.echeance ? new Date(p.echeance).getTime() : null
      return { ...p, niveauMax: Math.max(0, ...p.risques.map(r => r.niveau)), enRetard: p.statut !== 'FAIT' && ech !== null && ech < now.getTime(), _ech: ech }
    })
    .sort((a, b) =>
      (Number(a.statut === 'FAIT') - Number(b.statut === 'FAIT'))
      || (b.niveauMax - a.niveauMax)
      || ((RANG_PRIORITE[a.priorite] ?? 9) - (RANG_PRIORITE[b.priorite] ?? 9))
      || ((a._ech ?? Infinity) - (b._ech ?? Infinity))
      || a.titre.localeCompare(b.titre))
    .map(({ _ech, ...p }) => { void _ech; return p as T & { niveauMax: number; enRetard: boolean } })
}
