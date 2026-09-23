// ─── Saisie directe de risque (méthodes à appréciation G×V, PUR) ─────────────
// Pour les méthodes à saisie directe (ISO 31000 simple, cf. lib/methodes.ts), un
// risque est saisi directement — intitulé + gravité + vraisemblance — sans passer
// par les scénarios EBIOS. Ce module (sans DB) assainit l'entrée et **recalcule**
// le niveau (score = gravité × vraisemblance, source unique `computeRiskScore`).

import { clampInt } from '@/lib/import-sanitize'
import { computeRiskScore } from '@/lib/risk-scale'

/** Stratégies de traitement valides (enum Prisma StrategieTraitement). */
export const STRATEGIES = ['REDUIRE', 'ACCEPTER', 'TRANSFERER', 'REFUSER', 'SURVEILLER'] as const
export type Strategie = (typeof STRATEGIES)[number]

/**
 * Risque saisi directement, assaini — TROIS niveaux :
 *  - BRUT (inhérent)  : `gravite/vraisemblance/niveauRisque` — le risque sans mesure ;
 *  - ACTUEL (net)     : `*Actuelle/niveauActuel` — avec les mesures de sécurité existantes ;
 *  - RÉSIDUEL         : `*Residuelle/niveauResiduel` — après les plans d'action.
 * Les niveaux sont TOUJOURS recalculés (score = G×V), jamais fournis. À la création,
 * actuel = brut et résiduel = actuel (défauts chaînés) tant qu'ils ne sont pas abaissés.
 */
export interface DirectRisquePayload {
  nom: string
  gravite: number
  vraisemblance: number
  niveauRisque: number
  graviteActuelle: number
  vraisemblanceActuelle: number
  niveauActuel: number
  graviteResiduelle: number
  vraisemblanceResiduelle: number
  niveauResiduel: number
  strategie: Strategie
  description?: string
}

/**
 * Assainit un risque saisi directement : borne gravité/vraisemblance à [1,4] pour
 * les 3 niveaux, **recalcule** chaque niveau (score G×V), normalise la stratégie
 * (défaut REDUIRE), tronque les textes. Défauts chaînés : actuel ← brut, résiduel ←
 * actuel (si non fournis). Ne fait jamais confiance aux niveaux fournis.
 */
export function sanitizeDirectRisque(input: unknown): DirectRisquePayload {
  const o = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {}
  const gravite = clampInt(o.gravite, 1, 4, 2) as number
  const vraisemblance = clampInt(o.vraisemblance, 1, 4, 2) as number
  // Actuel : par défaut = brut ; résiduel : par défaut = actuel.
  const graviteActuelle = 'graviteActuelle' in o ? (clampInt(o.graviteActuelle, 1, 4, gravite) as number) : gravite
  const vraisemblanceActuelle = 'vraisemblanceActuelle' in o ? (clampInt(o.vraisemblanceActuelle, 1, 4, vraisemblance) as number) : vraisemblance
  const graviteResiduelle = 'graviteResiduelle' in o ? (clampInt(o.graviteResiduelle, 1, 4, graviteActuelle) as number) : graviteActuelle
  const vraisemblanceResiduelle = 'vraisemblanceResiduelle' in o ? (clampInt(o.vraisemblanceResiduelle, 1, 4, vraisemblanceActuelle) as number) : vraisemblanceActuelle
  const strategie: Strategie = STRATEGIES.includes(String(o.strategie) as Strategie)
    ? (String(o.strategie) as Strategie)
    : 'REDUIRE'
  return {
    nom: String(o.nom ?? '').slice(0, 255),
    gravite,
    vraisemblance,
    niveauRisque: computeRiskScore(gravite, vraisemblance),
    graviteActuelle,
    vraisemblanceActuelle,
    niveauActuel: computeRiskScore(graviteActuelle, vraisemblanceActuelle),
    graviteResiduelle,
    vraisemblanceResiduelle,
    niveauResiduel: computeRiskScore(graviteResiduelle, vraisemblanceResiduelle),
    strategie,
    ...(o.description != null ? { description: String(o.description).slice(0, 2000) } : {}),
  }
}

/** Vrai si le risque est exploitable (un intitulé est requis). */
export function isDirectRisqueValid(p: DirectRisquePayload): boolean {
  return p.nom.trim().length > 0
}

/**
 * Champs assainis d'une MISE À JOUR partielle (seuls les champs fournis). Le
 * `niveauRisque` N'est PAS inclus : l'appelant le **recalcule** via
 * `directNiveau(gFinal, vFinal)` sur les valeurs fusionnées (existant ⊕ patch),
 * pour garantir un score cohérent quel que soit le champ modifié.
 */
export function sanitizeDirectRisquePatch(input: unknown): Partial<Omit<DirectRisquePayload, 'niveauRisque' | 'niveauActuel' | 'niveauResiduel'>> {
  const o = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {}
  const out: Partial<Omit<DirectRisquePayload, 'niveauRisque' | 'niveauActuel' | 'niveauResiduel'>> = {}
  if ('nom' in o) out.nom = String(o.nom ?? '').slice(0, 255)
  if ('description' in o) out.description = o.description != null ? String(o.description).slice(0, 2000) : undefined
  if ('strategie' in o) out.strategie = STRATEGIES.includes(String(o.strategie) as Strategie) ? (String(o.strategie) as Strategie) : 'REDUIRE'
  if ('gravite' in o) out.gravite = clampInt(o.gravite, 1, 4, 2) as number
  if ('vraisemblance' in o) out.vraisemblance = clampInt(o.vraisemblance, 1, 4, 2) as number
  if ('graviteActuelle' in o) out.graviteActuelle = clampInt(o.graviteActuelle, 1, 4, 2) as number
  if ('vraisemblanceActuelle' in o) out.vraisemblanceActuelle = clampInt(o.vraisemblanceActuelle, 1, 4, 2) as number
  if ('graviteResiduelle' in o) out.graviteResiduelle = clampInt(o.graviteResiduelle, 1, 4, 2) as number
  if ('vraisemblanceResiduelle' in o) out.vraisemblanceResiduelle = clampInt(o.vraisemblanceResiduelle, 1, 4, 2) as number
  return out
}

/** Score de niveau d'un risque (source unique : gravité × vraisemblance). */
export function directNiveau(gravite: number, vraisemblance: number): number {
  return computeRiskScore(gravite, vraisemblance)
}

/**
 * Recalcule les niveaux à mettre à jour pour un PATCH, à partir des valeurs
 * FUSIONNÉES (existant ⊕ patch). Ne renvoie un niveau que si le G ou le V du niveau
 * concerné a été touché par le patch (recalcul ciblé, cohérent).
 */
export function recomputeDirectNiveaux(
  patch: Partial<Omit<DirectRisquePayload, 'niveauRisque' | 'niveauActuel' | 'niveauResiduel'>>,
  existing: { gravite: number; vraisemblance: number; graviteActuelle?: number | null; vraisemblanceActuelle?: number | null; graviteResiduelle?: number | null; vraisemblanceResiduelle?: number | null },
): { niveauRisque?: number; niveauActuel?: number; niveauResiduel?: number } {
  const out: { niveauRisque?: number; niveauActuel?: number; niveauResiduel?: number } = {}
  if (patch.gravite !== undefined || patch.vraisemblance !== undefined) {
    out.niveauRisque = directNiveau(patch.gravite ?? existing.gravite, patch.vraisemblance ?? existing.vraisemblance)
  }
  if (patch.graviteActuelle !== undefined || patch.vraisemblanceActuelle !== undefined) {
    out.niveauActuel = directNiveau(
      patch.graviteActuelle ?? existing.graviteActuelle ?? existing.gravite,
      patch.vraisemblanceActuelle ?? existing.vraisemblanceActuelle ?? existing.vraisemblance,
    )
  }
  if (patch.graviteResiduelle !== undefined || patch.vraisemblanceResiduelle !== undefined) {
    out.niveauResiduel = directNiveau(
      patch.graviteResiduelle ?? existing.graviteResiduelle ?? existing.gravite,
      patch.vraisemblanceResiduelle ?? existing.vraisemblanceResiduelle ?? existing.vraisemblance,
    )
  }
  return out
}
