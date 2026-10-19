// ─── Pagination côté serveur des grandes listes (lot V1, docs/specs/scalabilite-haute-disponibilite.md § 5 bis) ──
// Contrat des routes de liste : `?page=1&taille=50&tri=<champ>&ordre=asc|desc&q=<recherche>` + filtres propres.
// Sans `page`, la route garde sa réponse complète historique (consommateurs existants : menus, exports).
// Réponse paginée : les clés habituelles de la route + `pagination: { page, taille, total, pages }` + `synthese`
// (compteurs calculés sur TOUT le résultat filtré, jamais sur la seule page).

export const TAILLES_PAGE = [25, 50, 100] as const
export const TAILLE_DEFAUT = 50

export interface Pagination<T extends string = string> { page: number; taille: number; tri: T; ordre: 'asc' | 'desc'; q: string }
export interface MetaPagination { page: number; taille: number; total: number; pages: number }

/** Paramètres de pagination de l'URL ; null si `page` est absent (réponse complète historique). */
export function lirePagination<T extends string>(sp: URLSearchParams, opts: { tris: readonly T[]; triDefaut: T; ordreDefaut?: 'asc' | 'desc' }): Pagination<T> | null {
  if (!sp.has('page')) return null
  const page = Math.max(1, Number.parseInt(sp.get('page') ?? '1', 10) || 1)
  const t = Number(sp.get('taille'))
  const taille = (TAILLES_PAGE as readonly number[]).includes(t) ? t : TAILLE_DEFAUT
  const triDemande = sp.get('tri') as T | null
  const tri = triDemande && opts.tris.includes(triDemande) ? triDemande : opts.triDefaut
  const o = sp.get('ordre')
  const ordre = o === 'asc' || o === 'desc' ? o : (opts.ordreDefaut ?? 'asc')
  const q = (sp.get('q') ?? '').trim().slice(0, 200)
  return { page, taille, tri, ordre, q }
}

/** Page demandée d'une liste déjà filtrée et triée (page ramenée dans les bornes). */
export function paginer<T>(items: readonly T[], p: { page: number; taille: number }): { items: T[]; pagination: MetaPagination } {
  const total = items.length
  const pages = Math.max(1, Math.ceil(total / p.taille))
  const page = Math.min(Math.max(1, p.page), pages)
  return { items: items.slice((page - 1) * p.taille, page * p.taille), pagination: { page, taille: p.taille, total, pages } }
}

const cle = (v: unknown): string | number | null => {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'number') return v
  return String(v)
}
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

/** Tri stable ; texte sans casse ni accents ; valeurs absentes toujours en fin de liste. */
export function trier<T>(items: readonly T[], valeur: (x: T) => unknown, ordre: 'asc' | 'desc'): T[] {
  const sens = ordre === 'desc' ? -1 : 1
  return items.map((x, i) => ({ x, i, k: cle(valeur(x)) })).sort((a, b) => {
    if (a.k === null || b.k === null) return a.k === b.k ? a.i - b.i : a.k === null ? 1 : -1
    const c = typeof a.k === 'number' && typeof b.k === 'number' ? a.k - b.k : collator.compare(String(a.k), String(b.k))
    return c !== 0 ? sens * c : a.i - b.i
  }).map(e => e.x)
}

/** Recherche plein texte simple (sans casse ni accents) sur des champs. */
export function correspond(q: string, ...champs: (string | null | undefined)[]): boolean {
  if (!q) return true
  const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const nq = n(q)
  return champs.some(c => !!c && n(c).includes(nq))
}
