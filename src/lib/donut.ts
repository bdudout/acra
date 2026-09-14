/**
 * donut.ts — Géométrie pure d'un camembert « donut » rendu en SVG (trait sur un
 * cercle). Module PUR → testé unitairement, réutilisable par tout composant.
 *
 * Chaque part devient un segment d'anneau : longueur de trait proportionnelle à
 * sa valeur, décalage cumulatif pour l'enchaîner après les précédentes. Le SVG
 * appelant tourne le cercle de -90° pour démarrer en haut (midi).
 */

export interface DonutPart { key: string; value: number; color: string }

export interface DonutSegment {
  key: string
  color: string
  value: number
  /** Pourcentage entier (0–100) de la part sur le total. */
  pct: number
  /** Longueur du trait visible (stroke-dasharray, 1re valeur). */
  len: number
  /** Longueur du vide (stroke-dasharray, 2e valeur). */
  gap: number
  /** Décalage de départ (stroke-dashoffset), négatif = sens horaire. */
  offset: number
}

export interface Donut {
  total: number
  segments: DonutSegment[]
}

/**
 * Segments d'un donut pour une circonférence donnée. Les parts de valeur nulle
 * sont conservées (utile pour la légende) avec une longueur de trait nulle.
 */
export function donutSegments(parts: DonutPart[], circumference: number): Donut {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0)
  let cumul = 0
  const segments = parts.map(p => {
    const v = Math.max(0, p.value)
    const frac = total > 0 ? v / total : 0
    const len = frac * circumference
    const offset = -(cumul * circumference)
    cumul += frac
    return {
      key: p.key,
      color: p.color,
      value: v,
      pct: total > 0 ? Math.round(frac * 100) : 0,
      len,
      gap: circumference - len,
      offset,
    }
  })
  return { total, segments }
}
