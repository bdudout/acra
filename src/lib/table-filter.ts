/**
 * table-filter.ts — Filtre par colonne façon tableur (valeurs auto), RÉUTILISABLE
 * pour les tableaux (actions, risques, incidents, tiers…). Module PUR, testé.
 *
 * Modèle : `ColumnFilters` = { colKey → ensemble des valeurs AUTORISÉES }. Une
 * colonne absente de l'objet = aucun filtre (tout passe). Un ensemble présent =
 * on ne garde que les lignes dont la valeur (libellé) est dans l'ensemble.
 * Le tri reste géré par lib/table-sort.ts (mêmes accesseurs).
 */

export type ColumnFilters = Record<string, Set<string>>

/** Valeurs distinctes (libellés) d'une colonne, triées, non vides. */
export function distinctValues<T>(rows: readonly T[], accessor: (row: T) => unknown): string[] {
  const set = new Set<string>()
  for (const r of rows) {
    const v = accessor(r)
    if (v != null && v !== '') set.add(String(v))
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
}

/** Applique les filtres de colonnes (ET entre colonnes) via un accesseur de libellé. */
export function applyColumnFilters<T>(
  rows: readonly T[], filters: ColumnFilters, displayAccessor: (row: T, key: string) => unknown,
): T[] {
  const active = Object.keys(filters)
  if (active.length === 0) return [...rows]
  return rows.filter(r => active.every(key => filters[key].has(String(displayAccessor(r, key) ?? ''))))
}

/**
 * Bascule une valeur dans le filtre d'une colonne et renvoie le nouvel objet de
 * filtres. `all` = toutes les valeurs distinctes de la colonne : si après bascule
 * toutes sont autorisées, on RETIRE la colonne (plus de filtre → tout passe).
 */
export function toggleColumnValue(filters: ColumnFilters, key: string, value: string, all: readonly string[]): ColumnFilters {
  const current = filters[key] ?? new Set(all)
  const next = new Set(current)
  if (next.has(value)) next.delete(value); else next.add(value)
  const out = { ...filters }
  if (next.size >= all.length) delete out[key] // toutes cochées = pas de filtre
  else out[key] = next
  return out
}

/** Ne garder qu'une seule valeur (« filtrer sur celle-ci »). */
export function onlyColumnValue(filters: ColumnFilters, key: string, value: string): ColumnFilters {
  return { ...filters, [key]: new Set([value]) }
}

/** Efface le filtre d'une colonne (tout passe). */
export function clearColumnFilter(filters: ColumnFilters, key: string): ColumnFilters {
  const out = { ...filters }
  delete out[key]
  return out
}

/** Une colonne est-elle filtrée activement ? */
export function isColumnFiltered(filters: ColumnFilters, key: string): boolean {
  return !!filters[key]
}
