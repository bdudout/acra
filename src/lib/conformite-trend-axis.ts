/**
 * conformite-trend-axis.ts — Axe temporel REPLIABLE de la courbe « Historique &
 * tendance ». Module PUR (aucune dépendance UI/DOM), testé.
 *
 * L'axe est une suite de SEGMENTS de largeur égale (catégoriels) :
 *  • une année passée non dépliée = un seul segment libellé par l'année (clic →
 *    déplie ses sous-périodes) ;
 *  • l'année en cours et les années dépliées = un segment par sous-période selon
 *    la granularité (mois / trimestre / semestre), jusqu'à la période courante
 *    pour l'année en cours.
 * Un point de donnée est positionné dans son segment selon sa position temporelle
 * réelle → l'espacement reflète le temps sans laisser de trous.
 */

export type TrendGranularity = 'month' | 'quarter' | 'semester'

/** Segment de l'axe temporel de tendance (année/mois/trimestre/semestre) pour la courbe de conformité. */
export interface TrendSegment {
  key: string
  start: number // epoch ms (inclus)
  end: number   // epoch ms (exclu)
  year: number
  /** null = segment « année repliée » (cliquable pour déplier) ; sinon index de sous-période. */
  subIndex: number | null
  granularity: TrendGranularity | null
}

/** Nombre de mois par sous-période selon la granularité. */
export function monthsPerSub(g: TrendGranularity): number {
  return g === 'month' ? 1 : g === 'quarter' ? 3 : 6
}
/** Nombre de sous-périodes dans une année. */
export function subCount(g: TrendGranularity): number {
  return 12 / monthsPerSub(g)
}

/**
 * Construit les segments de l'axe pour la plage [minYear .. année de `now`].
 * `expanded` = années passées explicitement dépliées.
 */
export function buildSegments(now: Date, minYear: number, expanded: ReadonlySet<number>, g: TrendGranularity): TrendSegment[] {
  const curYear = now.getFullYear()
  const mps = monthsPerSub(g)
  const nSub = subCount(g)
  const segs: TrendSegment[] = []
  const from = Math.min(minYear, curYear)
  for (let y = from; y <= curYear; y++) {
    const isExpanded = y === curYear || expanded.has(y)
    if (!isExpanded) {
      segs.push({
        key: `y${y}`,
        start: new Date(y, 0, 1).getTime(),
        end: new Date(y + 1, 0, 1).getTime(),
        year: y, subIndex: null, granularity: null,
      })
      continue
    }
    // Année en cours : jusqu'à la sous-période courante ; années passées dépliées : entières.
    const last = y === curYear ? Math.floor(now.getMonth() / mps) : nSub - 1
    for (let i = 0; i <= last; i++) {
      segs.push({
        key: `y${y}s${i}`,
        start: new Date(y, i * mps, 1).getTime(),
        end: new Date(y, (i + 1) * mps, 1).getTime(),
        year: y, subIndex: i, granularity: g,
      })
    }
  }
  return segs
}

/**
 * Position d'un point (0..1 sur la largeur de l'axe) : index de son segment +
 * fraction temporelle dans ce segment, normalisé par le nombre de segments.
 */
export function pointX(dateMs: number, segs: readonly TrendSegment[]): number {
  if (segs.length === 0) return 0
  let idx = segs.findIndex(s => dateMs >= s.start && dateMs < s.end)
  if (idx < 0) idx = dateMs < segs[0].start ? 0 : segs.length - 1
  const s = segs[idx]
  const frac = s.end > s.start ? Math.min(1, Math.max(0, (dateMs - s.start) / (s.end - s.start))) : 0.5
  return (idx + frac) / segs.length
}

/** Année minimale présente dans une série de dates (défaut : année de `now`). */
export function minYearOf(datesMs: readonly number[], now: Date): number {
  if (datesMs.length === 0) return now.getFullYear()
  return new Date(Math.min(...datesMs)).getFullYear()
}
