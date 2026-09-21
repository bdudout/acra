/**
 * table-sort.ts — Tri de colonnes RÉUTILISABLE pour les tableaux (actions,
 * risques, tiers). Module PUR (aucune dépendance UI), testé. Pattern universel :
 * clic sur l'en-tête → asc, re-clic → desc, 3e clic → annulé. Les valeurs nulles
 * restent TOUJOURS en fin, quel que soit le sens.
 */

/** Sens de tri d'une colonne : ascendant ou descendant. */
export type SortDir = 'asc' | 'desc'
/** État de tri d'un tableau : colonne active + sens. */
export interface SortState { key: string; dir: SortDir }

/** Cycle d'un en-tête : aucun → asc → desc → aucun (null). */
export function nextSort(cur: SortState | null, key: string): SortState | null {
  if (!cur || cur.key !== key) return { key, dir: 'asc' }
  if (cur.dir === 'asc') return { key, dir: 'desc' }
  return null
}

/** Comparaison de base : nombres, dates (getTime), sinon chaîne localisée. */
function compareBase(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  if (typeof a === 'boolean' && typeof b === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0)
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * Trie une copie des lignes selon l'état de tri et un accesseur `(row, key) →
 * valeur`. Les valeurs null/undefined/'' sont toujours reléguées en fin.
 */
export function sortRows<T>(rows: readonly T[], sort: SortState | null, accessor: (row: T, key: string) => unknown): T[] {
  if (!sort) return [...rows]
  const sign = sort.dir === 'asc' ? 1 : -1
  const isEmpty = (v: unknown) => v == null || v === ''
  return [...rows].sort((x, y) => {
    const av = accessor(x, sort.key)
    const bv = accessor(y, sort.key)
    const ae = isEmpty(av), be = isEmpty(bv)
    if (ae && be) return 0
    if (ae) return 1   // valeurs vides toujours en fin
    if (be) return -1
    return sign * compareBase(av, bv)
  })
}

/** Symbole de tri à afficher pour une colonne donnée (en-tête). */
export function sortIndicator(sort: SortState | null, key: string): '' | '▲' | '▼' {
  if (!sort || sort.key !== key) return ''
  return sort.dir === 'asc' ? '▲' : '▼'
}
