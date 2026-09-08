// ─── Socle GRC — jeu de données d'export de la cartographie ──────────────────
// Construit, à partir des risques filtrés, le modèle commun aux exports XLSX et
// PDF : synthèse, grille de heat map (gravité × vraisemblance) et ventilations.
// Logique PURE (réutilise buildHeatmap/aggregateByDimension), testée.

import { buildHeatmap, aggregateByDimension, CARTO_MAX, type CartoRisk, type CartoMode, type NiveauBucket } from './cartographie'
import { getRiskLevel, type ScaleConfig } from './risk-scale'

export interface CartoExportRisk extends CartoRisk {
  statut: string
  provenance: string
  proprietaire: string | null
  niveauInherent: number | null
  niveauResiduel: number | null
}

export interface HeatGrid {
  /** Lignes de gravité, de la plus forte (CARTO_MAX) à la plus faible (1). */
  gravites: number[]
  /** Colonnes de vraisemblance, de 1 à CARTO_MAX. */
  vraisemblances: number[]
  /** counts[gravite][vraisemblance] = nombre de risques (0 si cellule vide). */
  counts: Record<number, Record<number, number>>
  /** Palier de chaque cellule non vide, pour la couleur. */
  buckets: Record<number, Record<number, NiveauBucket>>
  /** Couleur (#rrggbb) de CHAQUE cellule selon la matrice configurée (si fournie). */
  couleurs?: Record<number, Record<number, string>>
}

export interface CartoExportData {
  mode: CartoMode
  total: number
  parBucket: Record<NiveauBucket, number>
  nonCotes: number
  grid: HeatGrid
  /** `label` est résolu par l'appelant (libellé traduit de la taxonomie). */
  parCategorie: { key: string; label: string | null; count: number; maxNiveau: number | null }[]
  parProcessus: { key: string; label: string | null; count: number; maxNiveau: number | null }[]
  parEntite: { key: string; label: string | null; count: number; maxNiveau: number | null }[]
}

/**
 * Grille dense (toutes les cellules) à partir de la heat map creuse.
 * Si `config` (matrice configurée) est fourni, chaque cellule reçoit sa couleur
 * de palier exacte (`couleurs`), pour une heat map FIDÈLE à /configuration.
 */
export function buildHeatGrid(risks: CartoRisk[], mode: CartoMode, config?: Partial<ScaleConfig> | null): HeatGrid {
  const heat = buildHeatmap(risks, mode)
  const gravites = Array.from({ length: CARTO_MAX }, (_, i) => CARTO_MAX - i)
  const vraisemblances = Array.from({ length: CARTO_MAX }, (_, i) => i + 1)
  const counts: Record<number, Record<number, number>> = {}
  const buckets: Record<number, Record<number, NiveauBucket>> = {}
  const couleurs: Record<number, Record<number, string>> = {}
  for (const g of gravites) {
    counts[g] = {}; buckets[g] = {}; couleurs[g] = {}
    for (const v of vraisemblances) {
      counts[g][v] = 0
      if (config) couleurs[g][v] = getRiskLevel(g, v, config).couleur
    }
  }
  for (const cell of heat.cells) {
    counts[cell.gravite][cell.vraisemblance] = cell.risqueIds.length
    buckets[cell.gravite][cell.vraisemblance] = cell.bucket
  }
  return config ? { gravites, vraisemblances, counts, buckets, couleurs } : { gravites, vraisemblances, counts, buckets }
}

/**
 * Modèle complet d'export pour un périmètre de risques déjà filtré.
 * `categorieLabel` (optionnel) résout le libellé traduit d'un code de taxonomie ;
 * sans lui, le code brut est conservé.
 */
export function buildCartoExport(
  risks: CartoExportRisk[],
  mode: CartoMode,
  categorieLabel?: (code: string) => string | null,
  config?: Partial<ScaleConfig> | null,
): CartoExportData {
  const heat = buildHeatmap(risks, mode)
  const strip = (b: { key: string; label: string | null; count: number; maxNiveau: number | null }) =>
    ({ key: b.key, label: b.label, count: b.count, maxNiveau: b.maxNiveau })
  return {
    mode,
    total: risks.length,
    parBucket: heat.parBucket,
    nonCotes: heat.totalNonCote,
    grid: buildHeatGrid(risks, mode, config),
    parCategorie: aggregateByDimension(risks, 'taxonomie', mode).map(b => ({
      key: b.key,
      label: b.key && categorieLabel ? categorieLabel(b.key) : null,
      count: b.count,
      maxNiveau: b.maxNiveau,
    })),
    parProcessus: aggregateByDimension(risks, 'processus', mode).map(strip),
    parEntite: aggregateByDimension(risks, 'entite', mode).map(strip),
  }
}
