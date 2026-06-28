/**
 * ecosystem-measures.ts — Mesures de sécurité de l'écosystème (Atelier 3, issue #2).
 *
 * Une mesure écosystème porte : titre (`mesure`), description, partie prenante
 * concernée, priorité (P1→P4) et statut. Ce module ne contient que la logique pure
 * (priorités) ; le stockage reste en JSON sur le scénario stratégique.
 *
 * Module pur → testé unitairement (ecosystem-measures.test.ts).
 */

/** Priorités de traitement, de la plus urgente à la moins urgente. */
export const PRIORITES_MESURE = ['P1', 'P2', 'P3', 'P4'] as const
export type PrioriteMesure = typeof PRIORITES_MESURE[number]

const RANK: Record<string, number> = { P1: 0, P2: 1, P3: 2, P4: 3 }

/** Rang numérique d'une priorité (P1=0 … P4=3) ; les valeurs inconnues passent en dernier. */
export function prioriteRank(p: unknown): number {
  return RANK[String(p ?? '')] ?? 99
}

/** Comparateur de tri par priorité croissante (P1 d'abord). Stable sur priorité égale. */
export function comparePriorite(
  a: { priorite?: unknown; [k: string]: unknown },
  b: { priorite?: unknown; [k: string]: unknown },
): number {
  return prioriteRank(a?.priorite) - prioriteRank(b?.priorite)
}

// ── Mutualisation entre scénarios stratégiques (issue #2) ──────────────────────
// Une mesure est stockée UNE seule fois dans son scénario propriétaire ; le champ
// `scenarioIds` liste les scénarios ADDITIONNELS où elle s'applique aussi. Pas de
// duplication, pas de migration (JSON sur le scénario).

interface ScenarioLike { id: string; nom?: string; mesuresEcosysteme?: MeasureLike[] | null }
interface MeasureLike { id?: string; scenarioIds?: unknown; [k: string]: unknown }

/** Une mesure s'applique-t-elle à un scénario donné (propriétaire ou additionnel) ? */
export function measureAppliesTo(measure: MeasureLike, ownerId: string, scenarioId: string): boolean {
  if (ownerId === scenarioId) return true
  return Array.isArray(measure.scenarioIds) && measure.scenarioIds.map(String).includes(scenarioId)
}

/** Nombre de scénarios auxquels une mesure s'applique (propriétaire inclus, sans doublon). */
export function measureScenarioCount(measure: MeasureLike, ownerId: string): number {
  const ids = new Set<string>([ownerId])
  if (Array.isArray(measure.scenarioIds)) for (const x of measure.scenarioIds) ids.add(String(x))
  return ids.size
}

/**
 * Mesures (de tous les scénarios) qui s'appliquent à `scenarioId` — propriétaire
 * ou mutualisées. Chaque mesure renvoyée porte `_ownerId`/`_ownerNom` (provenance)
 * et `_mutualisee` (s'applique à > 1 scénario). Dédupliquée par id de mesure.
 */
export function measuresApplyingTo<T extends ScenarioLike>(
  scenarios: T[],
  scenarioId: string,
): (MeasureLike & { _ownerId: string; _ownerNom: string; _mutualisee: boolean })[] {
  const seen = new Set<string>()
  const out: (MeasureLike & { _ownerId: string; _ownerNom: string; _mutualisee: boolean })[] = []
  for (const sc of scenarios ?? []) {
    for (const m of sc.mesuresEcosysteme ?? []) {
      if (!measureAppliesTo(m, sc.id, scenarioId)) continue
      const key = String(m.id ?? '')
      if (key && seen.has(key)) continue
      if (key) seen.add(key)
      out.push({ ...m, _ownerId: sc.id, _ownerNom: sc.nom ?? '', _mutualisee: measureScenarioCount(m, sc.id) > 1 })
    }
  }
  return out
}
