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
export function comparePriorite(a: { priorite?: unknown }, b: { priorite?: unknown }): number {
  return prioriteRank(a?.priorite) - prioriteRank(b?.priorite)
}
