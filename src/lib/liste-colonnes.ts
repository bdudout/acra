// ─── Filtres « façon tableur » des listes paginées côté serveur (lot V1) — PUR ─────────────
// Les listes paginées gardent leurs filtres par colonne (ColumnMenu), mais le filtre s'exécute sur le serveur :
//   • le serveur renvoie, pour chaque colonne filtrable, ses CLÉS distinctes (code, nom… — jamais un libellé traduit) ;
//   • l'écran affiche les libellés (traduits) de ces clés et convertit la sélection de libellés en clés ;
//   • l'URL porte `col_<colonne>=<JSON des clés autorisées>` ; le serveur filtre avec lib/table-filter (mêmes règles).
// La clé '' (valeur absente) n'est proposée que si l'écran lui donne un libellé (ex. « — » pour une catégorie vide).
import { distinctValues, type ColumnFilters } from '@/lib/table-filter'

export const PREFIXE_COLONNE = 'col_'
/** Plafond défensif du nombre de valeurs d'un filtre de colonne lu dans l'URL. */
export const MAX_VALEURS_FILTRE = 500

/** Filtre d'une colonne lu dans l'URL (JSON d'un tableau de chaînes) ; null si absent ou illisible. */
export function lireFiltreColonne(v: string | null): Set<string> | null {
  if (v == null) return null
  try {
    const a = JSON.parse(v) as unknown
    if (!Array.isArray(a)) return null
    return new Set(a.filter((x): x is string => typeof x === 'string').slice(0, MAX_VALEURS_FILTRE))
  } catch { return null }
}

/** Valeur d'URL d'un filtre de colonne ; null = pas de filtre (paramètre retiré). */
export function ecrireFiltreColonne(cles: Iterable<string> | null | undefined): string | null {
  return cles == null ? null : JSON.stringify([...cles])
}

/** Filtres de colonnes de la requête (`col_<colonne>`), pour les seules colonnes prévues. */
export function lireFiltresColonnes(sp: URLSearchParams, colonnes: readonly string[]): ColumnFilters {
  const out: ColumnFilters = {}
  for (const c of colonnes) {
    const f = lireFiltreColonne(sp.get(PREFIXE_COLONNE + c))
    if (f) out[c] = f
  }
  return out
}

/** Clés distinctes d'une colonne (valeur absente comprise, sous la clé ''), triées. */
export function clesDistinctes<T>(rows: readonly T[], cle: (row: T) => string): string[] {
  return [...new Set(rows.map(cle))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
}

// ─── Côté écran : libellés ↔ clés ───────────────────────────────────────────────

/** Libellés proposés par le menu de colonne (mêmes règles que distinctValues : triés, non vides). */
export function libellesColonne(cles: readonly string[], libelle: (cle: string) => string): string[] {
  return distinctValues(cles, libelle)
}

/** Libellés autorisés correspondant aux clés autorisées de l'URL (undefined = pas de filtre). */
export function libellesDepuisCles(cles: Set<string> | null, libelle: (cle: string) => string): Set<string> | undefined {
  return cles ? new Set([...cles].map(libelle)) : undefined
}

/** Clés autorisées correspondant aux libellés cochés (undefined = pas de filtre). Un libellé partagé couvre toutes ses clés. */
export function clesDepuisLibelles(cles: readonly string[], libelle: (cle: string) => string, libelles: Set<string> | undefined): string[] | null {
  if (!libelles) return null
  return cles.filter(c => libelles.has(libelle(c)))
}
