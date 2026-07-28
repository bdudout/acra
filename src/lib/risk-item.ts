/**
 * risk-item.ts — Registre de risques canonique (socle GRC). Module PUR, testable.
 * Validation d'entrée, normalisation, calcul du niveau (gravité × vraisemblance).
 */

export const RISK_STATUTS = ['IDENTIFIE', 'EVALUE', 'TRAITE', 'ACCEPTE', 'CLOTURE'] as const
export type RiskStatut = typeof RISK_STATUTS[number]

export const RISK_PROVENANCES = ['MANUEL', 'ACRA', 'INCIDENT', 'CONTROLE', 'AUDIT'] as const
export type RiskProvenance = typeof RISK_PROVENANCES[number]

export interface RiskItemInput {
  intitule?: string | null
  description?: string | null
  taxonomieCode?: string | null
  processusId?: string | null
  entite?: string | null
  proprietaire?: string | null
  graviteInherente?: number | null
  vraisemblanceInherente?: number | null
  graviteResiduelle?: number | null
  vraisemblanceResiduelle?: number | null
  statut?: string | null
  provenance?: string | null
}

export type RiskItemInputError = 'intitule_requis' | 'cotation_invalide'

/** Borne des échelles (les échelles ACRA font 4 ou 5 niveaux) : 1..5, ou null. */
function coteValide(v: number | null | undefined): boolean {
  if (v == null) return true
  const n = Number(v)
  return Number.isFinite(n) && n >= 1 && n <= 5
}

/** Valide un risque AVANT écriture. Renvoie une clé d'erreur ou null. */
export function validateRiskItemInput(input: RiskItemInput): RiskItemInputError | null {
  if (!input.intitule?.trim()) return 'intitule_requis'
  for (const v of [input.graviteInherente, input.vraisemblanceInherente, input.graviteResiduelle, input.vraisemblanceResiduelle]) {
    if (!coteValide(v)) return 'cotation_invalide'
  }
  return null
}

const clampCote = (v: number | null | undefined): number | null => {
  if (v == null) return null
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.max(1, Math.min(5, n)) : null
}

/** Normalise un risque (bornes, statut/provenance dans l'allowlist, cotes 1-5|null). */
export function cleanRiskItem(input: RiskItemInput) {
  const statut = RISK_STATUTS.includes(input.statut as RiskStatut) ? (input.statut as RiskStatut) : 'IDENTIFIE'
  const provenance = RISK_PROVENANCES.includes(input.provenance as RiskProvenance) ? (input.provenance as RiskProvenance) : 'MANUEL'
  const txt = (v: string | null | undefined, max: number) => (v != null ? String(v).trim().slice(0, max) || null : null)
  return {
    intitule: String(input.intitule ?? '').trim().slice(0, 255),
    description: input.description != null ? String(input.description).slice(0, 5000) : null,
    taxonomieCode: txt(input.taxonomieCode, 40),
    processusId: input.processusId?.trim() ? input.processusId.trim() : null,
    entite: txt(input.entite, 200),
    proprietaire: txt(input.proprietaire, 200),
    graviteInherente: clampCote(input.graviteInherente),
    vraisemblanceInherente: clampCote(input.vraisemblanceInherente),
    graviteResiduelle: clampCote(input.graviteResiduelle),
    vraisemblanceResiduelle: clampCote(input.vraisemblanceResiduelle),
    statut,
    provenance,
  }
}

/** Niveau de risque = gravité × vraisemblance (null si l'une des deux manque). */
export function niveauRisque(gravite: number | null | undefined, vraisemblance: number | null | undefined): number | null {
  if (gravite == null || vraisemblance == null) return null
  const g = Number(gravite), v = Number(vraisemblance)
  if (!Number.isFinite(g) || !Number.isFinite(v)) return null
  return g * v
}
