// ─── Registre des risques : liste paginée côté serveur (lot V1) — PUR ──────────────────────
// Règles reprises de l'écran (components/RegistreRisques) pour s'exécuter sur le serveur sur des lignes LÉGÈRES :
// pré-filtre par palier du niveau résiduel (deep-link pilotage ?niveau=), filtres de colonnes (catégorie,
// processus, statut), recherche, tri des colonnes. Les compteurs portent sur tout le registre.
import { niveauBucket } from '@/lib/cartographie'
import { RISK_STATUTS } from '@/lib/risk-item'
import { applyColumnFilters, type ColumnFilters } from '@/lib/table-filter'
import { correspond } from '@/lib/pagination'
import { clesDistinctes } from '@/lib/liste-colonnes'
import { mostFrequentString } from '@/lib/most-frequent'

export const TRIS_RISQUES = ['defaut', 'intitule', 'category', 'process', 'inherent', 'residual', 'statut', 'actions'] as const
export type TriRisque = (typeof TRIS_RISQUES)[number]
export const COLONNES_RISQUES = ['category', 'process', 'statut'] as const
export const NIVEAUX_FILTRE = ['eleve', 'moyen', 'faible'] as const

export interface RisqueLeger {
  id: string
  intitule: string
  taxonomieCode: string | null
  processusNom: string | null
  entite: string | null
  proprietaire: string | null
  statut: string
  niveauInherent: number | null
  niveauResiduel: number | null
  /** Taux d'avancement du plan d'action (calculé seulement pour le tri « actions »). */
  tauxAvancement?: number
}

/** Clé de filtre d'une colonne (code / nom / statut ; '' = non renseigné). */
export function cleColonneRisque(r: RisqueLeger, col: string): string {
  switch (col) {
    case 'category': return r.taxonomieCode ?? ''
    case 'process': return r.processusNom ?? ''
    case 'statut': return r.statut
    default: return ''
  }
}

/** Palier du niveau résiduel lu dans l'URL (eleve|moyen|faible, sans casse) ; '' sinon. */
export function lireNiveau(v: string | null | undefined): string {
  const n = (v ?? '').toLowerCase()
  return (NIVEAUX_FILTRE as readonly string[]).includes(n) ? n : ''
}

/** Base de la liste : pré-filtre par palier du niveau résiduel (comme l'écran). */
export function baseRisques<T extends RisqueLeger>(rows: readonly T[], niveau: string): T[] {
  return niveau ? rows.filter(x => x.niveauResiduel != null && niveauBucket(x.niveauResiduel) === niveau) : [...rows]
}

/** Recherche + filtres de colonnes appliqués à la base. */
export function filtrerRisques<T extends RisqueLeger>(base: readonly T[], f: { q: string; colonnes: ColumnFilters }): T[] {
  const cherches = f.q ? base.filter(x => correspond(f.q, x.intitule, x.entite, x.proprietaire, x.processusNom)) : [...base]
  return applyColumnFilters(cherches, f.colonnes, cleColonneRisque)
}

const RANG_STATUT: Record<string, number> = Object.fromEntries(RISK_STATUTS.map((s, i) => [s, i]))

/** Valeur de tri d'une colonne (null pour l'ordre par défaut : création décroissante). */
export function valeurTriRisque(tri: TriRisque): ((x: RisqueLeger) => unknown) | null {
  switch (tri) {
    case 'intitule': return x => x.intitule
    // Catégorie : triée par code (le libellé est traduit à l'écran) ; les risques d'une même catégorie restent groupés.
    case 'category': return x => x.taxonomieCode
    case 'process': return x => x.processusNom
    case 'inherent': return x => x.niveauInherent
    case 'residual': return x => x.niveauResiduel
    case 'statut': return x => RANG_STATUT[x.statut] ?? 99
    case 'actions': return x => x.tauxAvancement ?? 0
    default: return null
  }
}

export interface SyntheseRisques {
  /** Risques du registre (toute la liste). */
  total: number
  /** Entité la plus saisie (valeur par défaut du formulaire). */
  entiteFrequente: string
  /** Clés distinctes des colonnes filtrables, sur la base (après palier de niveau). */
  valeurs: Record<(typeof COLONNES_RISQUES)[number], string[]>
}

export function syntheseRisques(tous: readonly RisqueLeger[], base: readonly RisqueLeger[]): SyntheseRisques {
  return {
    total: tous.length,
    entiteFrequente: mostFrequentString(tous.map(x => x.entite)),
    valeurs: {
      category: clesDistinctes(base, x => cleColonneRisque(x, 'category')),
      process: clesDistinctes(base, x => cleColonneRisque(x, 'process')),
      statut: clesDistinctes(base, x => cleColonneRisque(x, 'statut')),
    },
  }
}
