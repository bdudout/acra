/**
 * risk-current.ts — Position « à date » d'un risque sur la matrice.
 *
 * EBIOS RM distingue le risque BRUT (avant traitement) et le risque RÉSIDUEL
 * (cible, une fois tout le plan d'action mis en œuvre). La position « à date »
 * reflète l'avancement RÉEL : on interpole linéairement entre le brut et le
 * résiduel cible selon la proportion de mesures déjà réalisées pour ce risque.
 *
 *   avancement c = (mesures REALISE liées) / (total mesures liées)   ∈ [0..1]
 *   coord_à_date = round(brut + c × (résiduel − brut))               (borné 1..4)
 *
 * Règles : EN_COURS compte comme non fait ; sans mesure liée ou sans cible
 * résiduelle, le risque reste à sa position brute. Module pur → testé.
 */

export interface MeasureLike {
  risqueId?: string | null
  statut?: string | null
}

export interface RiskLike {
  id: string
  gravite: number
  vraisemblance: number
  graviteResiduelle?: number | null
  vraisemblanceResiduelle?: number | null
}

const clamp14 = (n: number) => Math.max(1, Math.min(4, n))

/** Proportion de mesures REALISE parmi les mesures liées au risque (0 si aucune). */
export function completionRatio(riskId: string, mesures: MeasureLike[]): number {
  const linked = mesures.filter(m => m.risqueId === riskId)
  if (linked.length === 0) return 0
  const done = linked.filter(m => m.statut === 'REALISE').length
  return done / linked.length
}

/**
 * Coordonnées « à date » (gravité, vraisemblance) du risque, interpolées entre
 * brut et résiduel cible selon l'avancement. Reste au brut si pas de cible
 * résiduelle définie ou pas de mesure réalisée.
 */
export function risqueADate(risque: RiskLike, mesures: MeasureLike[]): { gravite: number; vraisemblance: number } {
  const hasResidual = risque.graviteResiduelle != null && risque.vraisemblanceResiduelle != null
  if (!hasResidual) return { gravite: risque.gravite, vraisemblance: risque.vraisemblance }

  const c = completionRatio(risque.id, mesures)
  const g = Math.round(risque.gravite + c * (risque.graviteResiduelle! - risque.gravite))
  const v = Math.round(risque.vraisemblance + c * (risque.vraisemblanceResiduelle! - risque.vraisemblance))
  return { gravite: clamp14(g), vraisemblance: clamp14(v) }
}
