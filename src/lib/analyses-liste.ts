// ─── Liste des analyses : filtres et tri (lot V1, pagination côté serveur) ────────────────
// Règles de l'écran « Analyses » déplacées côté serveur (GET /api/analyses?page=…) : filtre de
// statut (paramètre d'URL `filter`, deep-link historique), tag, recherche, tri par défaut par risque.
import { filtrerParTag } from '@/lib/analyse-tags'
import { correspond, trier } from '@/lib/pagination'

export type FiltreStatutAnalyse = 'ALL' | 'EN_COURS' | 'TERMINE' | 'SOUMIS' | 'APPROUVE'

/** Paramètre d'URL `filter` (en_cours, termine, soumis, approuve) → statut filtré. */
export function statutDepuisParam(p: string | null | undefined): FiltreStatutAnalyse {
  switch (p) {
    case 'en_cours': return 'EN_COURS'
    case 'termine':  return 'TERMINE'
    case 'soumis':   return 'SOUMIS'
    case 'approuve': return 'APPROUVE'
    default:         return 'ALL'
  }
}

/** Champs nécessaires aux filtres et au tri (requête légère). */
export interface AnalyseTriable {
  nom: string
  organisation: string | null
  statut: string
  tags?: string[] | null
  atelierCourant: number
  updatedAt: Date | string
  _count: { risques: number }
  riskSummary?: { maxRisk: number } | null
}

export const TRIS_ANALYSES = ['defaut', 'nom', 'statut', 'organisation', 'atelier', 'risques', 'modifie'] as const
export type TriAnalyses = (typeof TRIS_ANALYSES)[number]

/** Tri par défaut de l'écran : niveau de risque max desc, puis nombre de risques desc, puis dernière modification desc. */
export function comparerParRisque(a: AnalyseTriable, b: AnalyseTriable): number {
  const maxA = a.riskSummary?.maxRisk ?? 0
  const maxB = b.riskSummary?.maxRisk ?? 0
  if (maxB !== maxA) return maxB - maxA
  if (b._count.risques !== a._count.risques) return b._count.risques - a._count.risques
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
}

/** Filtres de l'écran : tag (exact, sans casse), statut, recherche sur le nom et l'organisation. */
export function filtrerAnalyses<T extends AnalyseTriable>(items: T[], f: { q?: string; statut?: FiltreStatutAnalyse; tag?: string }): T[] {
  const statut = f.statut ?? 'ALL'
  return filtrerParTag(items, f.tag ?? '')
    .filter(a => statut === 'ALL' || a.statut === statut)
    .filter(a => correspond(f.q ?? '', a.nom, a.organisation))
}

/** Tri demandé ; `defaut` = tri par risque de l'écran (l'ordre n'inverse que les tris par colonne). */
export function trierAnalyses<T extends AnalyseTriable>(items: T[], tri: TriAnalyses, ordre: 'asc' | 'desc'): T[] {
  if (tri === 'defaut') return [...items].sort(comparerParRisque)
  const cle: Record<Exclude<TriAnalyses, 'defaut'>, (a: T) => unknown> = {
    nom: a => a.nom, statut: a => a.statut, organisation: a => a.organisation, atelier: a => a.atelierCourant,
    risques: a => a._count.risques, modifie: a => new Date(a.updatedAt),
  }
  return trier(items, cle[tri], ordre)
}
