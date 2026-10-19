// ─── Vue unifiée des plans d'action : liste paginée côté serveur (lot V1) — PUR ──
// Filtres à facettes, filtre par entité, filtres de colonne « façon tableur », tri et compteurs, exécutés côté
// serveur (GET /api/actions ?page=…) avec les règles EXISTANTES de la vue (filterActionItems, sortActionItems,
// filtrerParEntite, applyColumnFilters, sortRows) : seules les valeurs de colonne passent des libellés traduits aux
// CODES (origine, priorité, statut effectif), le client traduisant à l'affichage.
// Spec : docs/specs/scalabilite-haute-disponibilite.md § 5 bis.
import {
  filterActionItems, sortActionItems, summarizeActionItems, ACTION_ORIGINES,
  type ActionItem, type ActionItemFiltre, type ActionOrigine, type EcheanceBucket,
} from './action-items'
import { effectiveStatut, ACTION_PRIORITES, type ActionPriorite, type ActionsSummary } from './risk-action'
import { applyColumnFilters, distinctValues, type ColumnFilters } from './table-filter'
import { sortRows } from './table-sort'
import { filtrerParEntite } from './entites-filtre'
import { paginer, type MetaPagination, type Pagination } from './pagination'
import type { EntiteRef } from './entites'

export const TRIS_ACTIONS = ['defaut', 'titre', 'origine', 'porteur', 'priorite', 'statut', 'echeance'] as const
export type TriAction = (typeof TRIS_ACTIONS)[number]
/** Colonnes filtrables « façon tableur » (valeurs = codes, sauf porteur). */
export const COLONNES_FILTRABLES = ['origine', 'porteur', 'priorite', 'statut'] as const
export type ColonneFiltrable = (typeof COLONNES_FILTRABLES)[number]

const STATUTS = ['A_FAIRE', 'EN_COURS', 'FAIT', 'EN_RETARD'] as const
const ECHEANCES: readonly EcheanceBucket[] = ['retard', 'semaine', 'mois', 'sans']
const PRIORITE_RANK: Record<ActionPriorite, number> = { CRITIQUE: 0, MAJEUR: 1, MODERE: 2 }
const STATUT_RANK: Record<string, number> = { EN_RETARD: 0, A_FAIRE: 1, EN_COURS: 2, FAIT: 3 }

export interface FiltresActions {
  filtre: ActionItemFiltre
  entite: { id: string; sous: boolean }
  colonnes: ColumnFilters
}

/**
 * Lecture des filtres de la vue depuis l'URL. Deep-links historiques conservés : `priorite=1|2|3`
 * (P1 → CRITIQUE…) et `filtre=retard` (fenêtre d'échéance « en retard »).
 */
export function lireFiltresActions(sp: URLSearchParams): FiltresActions {
  const f: ActionItemFiltre = {}
  const origine = sp.get('origine')
  if (origine && (ACTION_ORIGINES as readonly string[]).includes(origine)) f.origine = origine as ActionOrigine
  const priorite = prioriteDepuisUrl(sp.get('priorite'))
  if (priorite) f.priorite = priorite
  const statut = sp.get('statut')
  if (statut && (STATUTS as readonly string[]).includes(statut)) f.statut = statut as ActionItemFiltre['statut']
  const echeance = echeanceDepuisUrl(sp)
  if (echeance) f.echeanceBucket = echeance
  const porteur = (sp.get('porteur') ?? '').slice(0, 200)
  if (porteur.trim()) f.porteur = porteur
  const q = (sp.get('q') ?? '').slice(0, 200)
  if (q.trim()) f.q = q
  return { filtre: f, entite: { id: sp.get('entite') ?? '', sous: sp.get('sousEntites') !== '0' }, colonnes: lireColonnes(sp.get('col')) }
}

/** Priorité de l'URL : code, ou chiffre historique 1/2/3. */
export function prioriteDepuisUrl(v: string | null): ActionPriorite | '' {
  if (v === '1') return 'CRITIQUE'
  if (v === '2') return 'MAJEUR'
  if (v === '3') return 'MODERE'
  return v && (ACTION_PRIORITES as readonly string[]).includes(v) ? (v as ActionPriorite) : ''
}

/** Fenêtre d'échéance de l'URL : `echeance=…`, ou l'historique `filtre=retard`. */
export function echeanceDepuisUrl(sp: URLSearchParams): EcheanceBucket | '' {
  const e = sp.get('echeance') || (sp.get('filtre') === 'retard' ? 'retard' : '')
  return (ECHEANCES as readonly string[]).includes(e) ? (e as EcheanceBucket) : ''
}

/** Filtres de colonne sérialisés dans l'URL : `col={"origine":["risque"],…}` (JSON, valeurs = codes). */
export function lireColonnes(brut: string | null): ColumnFilters {
  if (!brut) return {}
  try {
    const o = JSON.parse(brut) as unknown
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {}
    const out: ColumnFilters = {}
    for (const k of COLONNES_FILTRABLES) {
      const v = (o as Record<string, unknown>)[k]
      if (Array.isArray(v)) out[k] = new Set(v.filter((x): x is string => typeof x === 'string').slice(0, 500))
    }
    return out
  } catch { return {} }
}

/** Sérialisation inverse de lireColonnes ; null si aucun filtre de colonne (paramètre retiré de l'URL). */
export function ecrireColonnes(c: ColumnFilters): string | null {
  const o: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(c)) o[k] = [...v]
  return Object.keys(o).length ? JSON.stringify(o) : null
}

/** Valeur (code) d'une colonne filtrable : base des filtres « façon tableur » côté serveur. */
export function valeurColonne(it: ActionItem, key: string, now: Date): string {
  switch (key) {
    case 'origine': return it.origine
    case 'porteur': return it.porteur ?? ''
    case 'priorite': return it.priorite
    case 'statut': return effectiveStatut(it, now)
    default: return ''
  }
}

/** Clé de tri d'une colonne : priorité et statut par rang métier, échéance par date. */
export function cleTriAction(it: ActionItem, key: string, now: Date): unknown {
  switch (key) {
    case 'titre': return it.titre
    case 'origine': return it.origine
    case 'porteur': return it.porteur
    case 'priorite': return PRIORITE_RANK[it.priorite]
    case 'statut': return STATUT_RANK[effectiveStatut(it, now)]
    case 'echeance': return it.echeance
    default: return ''
  }
}

export interface SyntheseActions extends ActionsSummary { orphelines: number }

export interface PageActions {
  items: ActionItem[]
  pagination: MetaPagination
  /** Compteurs de tête d'écran, sur TOUTES les actions (comme la vue avant pagination). */
  synthese: SyntheseActions
  /** Valeurs distinctes (codes) des colonnes filtrables, après les filtres à facettes. */
  valeurs: Record<ColonneFiltrable, string[]>
}

/**
 * Pipeline de la vue (inchangé) : facettes → entité → filtres de colonne → tri (colonne, sinon tri métier) → page.
 */
export function listerActionsPage(items: ActionItem[], f: FiltresActions, pg: Pagination<TriAction>, entites: EntiteRef[], now: Date): PageActions {
  const facettes = filtrerParEntite(filterActionItems(items, f.filtre, now), entites, f.entite.id, f.entite.sous)
  const valeurs = Object.fromEntries(COLONNES_FILTRABLES.map(k => [k, distinctValues(facettes, it => valeurColonne(it, k, now))])) as Record<ColonneFiltrable, string[]>
  const filtres = applyColumnFilters(facettes, f.colonnes, (it, k) => valeurColonne(it, k, now))
  const tries = pg.tri === 'defaut' ? sortActionItems(filtres, now) : sortRows(filtres, { key: pg.tri, dir: pg.ordre }, (it, k) => cleTriAction(it, k, now))
  const page = paginer(tries, pg)
  return {
    items: page.items,
    pagination: page.pagination,
    synthese: { ...summarizeActionItems(items, now), orphelines: items.filter(i => i.origine === 'orpheline').length },
    valeurs,
  }
}
