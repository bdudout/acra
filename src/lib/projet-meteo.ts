// ─── Météo d'un projet 360 (réglée à la main par le chef de projet) — PUR ─────
// SOLEIL (tout va bien) · SOLEIL_NUAGE (vigilance) · NUAGE (difficultés) · ORAGE (projet en danger).
// Stockée dans Analyse.meteoProjet ; null = non renseignée. Testé : projet-burndown.test.ts.
export const METEOS = ['SOLEIL', 'SOLEIL_NUAGE', 'NUAGE', 'ORAGE'] as const
export type Meteo = (typeof METEOS)[number]

/** Valeur connue → elle-même ; vide / null → null (effacer) ; autre → undefined (refusée). */
export function sanitizeMeteo(v: unknown): Meteo | null | undefined {
  if (v === null || v === '') return null
  return (METEOS as readonly unknown[]).includes(v) ? v as Meteo : undefined
}
