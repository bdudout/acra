/**
 * risk-scale.ts — Source unique de calcul du niveau de risque (EBIOS RM).
 *
 * Remplace les logiques divergentes qui coexistaient :
 *  - RiskMatrix : moyenne additive (v+g)/2 codée en dur
 *  - getNiveauRisqueLabel : seuils 4/8/12 codés en dur
 *  - DEFAULT_SEUILS_MATRICE : seuils multiplicatifs configurables
 *
 * Le modèle retenu (conforme à la configuration administrable) :
 *   score = gravité × vraisemblance, puis classement via les seuils de la matrice.
 *
 * Toutes les fonctions sont pures et pilotées par la `ScaleConfig` fournie par
 * l'administrateur (échelles + seuils), avec repli sur les valeurs par défaut.
 */

import {
  buildDefaultConfig,
  DEFAULT_SEUILS_MATRICE,
} from '@/lib/configuration-defaults'

export interface EchelleNiveau {
  niveau: number
  label: string
  description?: string
  couleur: string
}

export interface Seuil {
  scoreMin: number
  scoreMax: number
  label: string
  couleur: string
}

export type MatriceMode = 'QUANTITATIVE' | 'QUALITATIVE'

/** Niveau attribué manuellement à une case (mode qualitatif). */
export interface QualitativeCell {
  gravite: number
  vraisemblance: number
  seuilLabel: string
}

export interface ScaleConfig {
  nbNiveaux: number
  echelleGravite: EchelleNiveau[]
  echelleVraisemblance: EchelleNiveau[]
  seuilsMatrice: Seuil[]
  /** Mode d'évaluation : multiplication (quantitatif) ou matrice définie à la main (qualitatif) */
  matriceMode?: MatriceMode
  /** Niveaux attribués manuellement par case (utilisé si matriceMode=QUALITATIVE) */
  matriceQualitative?: QualitativeCell[] | null
}

/** Score de risque = gravité × vraisemblance (modèle EBIOS RM). */
export function computeRiskScore(gravite: number, vraisemblance: number): number {
  return gravite * vraisemblance
}

/**
 * Classification canonique d'un score de risque en 4 paliers.
 * Source unique pour les listes, le dashboard et la page risques — remplace
 * les comparaisons codées en dur (>= 12, >= 8, >= 4) éparpillées.
 * Frontières alignées sur DEFAULT_SEUILS_MATRICE et getNiveauRisqueLabel.
 */
export type RiskTier = 'faible' | 'modere' | 'eleve' | 'critique'

export const RISK_TIER_THRESHOLDS = { critique: 12, eleve: 8, modere: 4 } as const

export function getRiskTier(score: number): RiskTier {
  if (score >= RISK_TIER_THRESHOLDS.critique) return 'critique'
  if (score >= RISK_TIER_THRESHOLDS.eleve)    return 'eleve'
  if (score >= RISK_TIER_THRESHOLDS.modere)   return 'modere'
  return 'faible'
}

/** Retourne le seuil dont la plage contient le score, ou null. */
export function getRiskLevelFromSeuils(score: number, seuils: Seuil[]): Seuil | null {
  return seuils.find(s => score >= s.scoreMin && score <= s.scoreMax) ?? null
}

/**
 * Niveau de risque pour un couple (gravité, vraisemblance) selon la config.
 * Garantit un résultat non-null (repli sur le seuil le plus proche).
 */
export function getRiskLevel(
  gravite: number,
  vraisemblance: number,
  config?: Partial<ScaleConfig> | null
): Seuil {
  const cfg = resolveScaleConfig(config)

  // Mode qualitatif : niveau défini manuellement pour cette case (si présent)
  if (cfg.matriceMode === 'QUALITATIVE' && cfg.matriceQualitative?.length) {
    const manual = cfg.matriceQualitative.find(
      c => c.gravite === gravite && c.vraisemblance === vraisemblance
    )
    if (manual) {
      const seuil = cfg.seuilsMatrice.find(s => s.label === manual.seuilLabel)
      if (seuil) return seuil
    }
    // Pas de définition manuelle pour cette case → repli sur le quantitatif
  }

  const score = computeRiskScore(gravite, vraisemblance)
  const seuil = getRiskLevelFromSeuils(score, cfg.seuilsMatrice)
  if (seuil) return seuil
  // Repli : sous le minimum → premier seuil ; au-dessus du max → dernier seuil
  const sorted = [...cfg.seuilsMatrice].sort((a, b) => a.scoreMin - b.scoreMin)
  if (sorted.length === 0) return { scoreMin: 0, scoreMax: Infinity, label: 'Modéré', couleur: '#f59e0b' }
  return score < sorted[0].scoreMin ? sorted[0] : sorted[sorted.length - 1]
}

/** Complète une config partielle/absente avec les valeurs par défaut. */
export function resolveScaleConfig(config?: Partial<ScaleConfig> | null): ScaleConfig {
  const nbNiveaux = config?.nbNiveaux === 5 ? 5 : 4
  const defaults = buildDefaultConfig(nbNiveaux) as ScaleConfig
  return {
    nbNiveaux,
    echelleGravite:       config?.echelleGravite?.length       ? config.echelleGravite       : defaults.echelleGravite,
    echelleVraisemblance: config?.echelleVraisemblance?.length ? config.echelleVraisemblance : defaults.echelleVraisemblance,
    seuilsMatrice:        config?.seuilsMatrice?.length        ? config.seuilsMatrice        : (defaults.seuilsMatrice ?? DEFAULT_SEUILS_MATRICE),
    matriceMode:          config?.matriceMode === 'QUALITATIVE' ? 'QUALITATIVE' : 'QUANTITATIVE',
    matriceQualitative:   config?.matriceQualitative ?? null,
  }
}

/**
 * Génère une matrice qualitative initialisée sur les valeurs quantitatives
 * (une case par couple gravité × vraisemblance). Point de départ que
 * l'administrateur peut ensuite ajuster case par case.
 */
export function buildDefaultQualitativeMatrix(config?: Partial<ScaleConfig> | null): QualitativeCell[] {
  const cfg = resolveScaleConfig({ ...config, matriceMode: 'QUANTITATIVE' })
  const cells: QualitativeCell[] = []
  for (const g of cfg.echelleGravite) {
    for (const v of cfg.echelleVraisemblance) {
      cells.push({
        gravite: g.niveau,
        vraisemblance: v.niveau,
        seuilLabel: getRiskLevel(g.niveau, v.niveau, cfg).label,
      })
    }
  }
  return cells
}

export interface MatrixCell {
  gravite: number
  vraisemblance: number
  score: number
  label: string
  couleur: string
}

export interface MatrixModel {
  nbNiveaux: number
  graviteLevels: EchelleNiveau[]       // colonnes (gravité croissante)
  vraisemblanceLevels: EchelleNiveau[] // niveaux de vraisemblance (croissants)
  cells: MatrixCell[][]                // cells[ligne][colonne], lignes triées vraisemblance décroissante
}

/**
 * Construit le modèle complet de la matrice des risques à partir de la config.
 * Lignes = vraisemblance (décroissante, plus probable en haut),
 * colonnes = gravité (croissante).
 */
export function buildRiskMatrixModel(config?: Partial<ScaleConfig> | null): MatrixModel {
  const cfg = resolveScaleConfig(config)
  const graviteLevels       = [...cfg.echelleGravite].sort((a, b) => a.niveau - b.niveau)
  const vraisemblanceLevels = [...cfg.echelleVraisemblance].sort((a, b) => a.niveau - b.niveau)

  const cells: MatrixCell[][] = [...vraisemblanceLevels]
    .sort((a, b) => b.niveau - a.niveau) // décroissant : haut = plus probable
    .map(v =>
      graviteLevels.map(g => {
        const score = computeRiskScore(g.niveau, v.niveau)
        const level = getRiskLevel(g.niveau, v.niveau, cfg)
        return {
          gravite: g.niveau,
          vraisemblance: v.niveau,
          score,
          label: level.label,
          couleur: level.couleur,
        }
      })
    )

  return { nbNiveaux: cfg.nbNiveaux, graviteLevels, vraisemblanceLevels, cells }
}
