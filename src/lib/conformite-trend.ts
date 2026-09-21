/**
 * conformite-trend.ts — Série temporelle de la conformité GLOBALE (tous suivis).
 * Module PUR → testé.
 *
 * Chaque suivi (org × référentiel × entité) a une timeline de points datés
 * (snapshots + point courant) : { date, conforme, pertinents }. Pour tracer une
 * tendance globale, on agrège « à la date » (as-of) : à chaque date connue, on
 * additionne, pour chaque suivi, son dernier point ≤ cette date (le suivi qui
 * n'existait pas encore est ignoré). Taux global = Σconforme / Σpertinents.
 */

export interface TrendSuivi {
  points: { date: string | Date; conforme: number; pertinents: number }[]
}

/** Point de la courbe de tendance de conformité : date ISO + taux et compteurs à cette date. */
export interface TrendPoint {
  date: string        // ISO
  taux: number        // % entier
  conforme: number
  pertinents: number
}

const ts = (d: string | Date): number => (d instanceof Date ? d.getTime() : new Date(d).getTime())

/**
 * Courbe de tendance de la conformité GLOBALE. À chaque date distincte, somme le
 * dernier point « as-of » (≤ date) de chaque référentiel puis en déduit le taux ;
 * réduit ensuite à AU PLUS un point par jour calendaire (le plus récent du jour).
 */
export function globalConformiteTrend(suivis: TrendSuivi[]): TrendPoint[] {
  // Timelines triées par date croissante, dates valides uniquement.
  const timelines = suivis
    .map(s => s.points.filter(p => Number.isFinite(ts(p.date))).slice().sort((a, b) => ts(a.date) - ts(b.date)))
    .filter(tl => tl.length > 0)
  if (timelines.length === 0) return []

  // Ensemble des dates distinctes (toutes timelines confondues), triées.
  const dates = [...new Set(timelines.flatMap(tl => tl.map(p => ts(p.date))))].sort((a, b) => a - b)

  const out: TrendPoint[] = []
  for (const d of dates) {
    let conforme = 0, pertinents = 0
    for (const tl of timelines) {
      // Dernier point du suivi à cette date (as-of) : le plus récent ≤ d.
      let asOf: { conforme: number; pertinents: number } | null = null
      for (const p of tl) { if (ts(p.date) <= d) asOf = p; else break }
      if (asOf) { conforme += asOf.conforme; pertinents += asOf.pertinents }
    }
    out.push({
      date: new Date(d).toISOString(),
      conforme, pertinents,
      taux: pertinents > 0 ? Math.round((conforme / pertinents) * 100) : 0,
    })
  }

  // Lisibilité : AU PLUS un point par jour calendaire (le plus récent du jour).
  // `out` est chronologique → set() écrase par la valeur la plus récente en
  // conservant la position (ordre) du jour.
  const byDay = new Map<string, TrendPoint>()
  for (const pt of out) {
    const dt = new Date(pt.date)
    byDay.set(`${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`, pt)
  }
  return [...byDay.values()]
}
