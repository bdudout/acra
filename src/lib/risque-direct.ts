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

/** Risque saisi directement, assaini. `niveauRisque` = score G×V (jamais fourni). */
export interface DirectRisquePayload {
  nom: string
  gravite: number
  vraisemblance: number
  niveauRisque: number
  strategie: Strategie
  description?: string
}

/**
 * Assainit un risque saisi directement : borne gravité/vraisemblance à [1,4],
 * **recalcule** le niveau (score G×V), normalise la stratégie (défaut REDUIRE),
 * tronque les textes. Ne fait jamais confiance à `niveauRisque` fourni.
 */
export function sanitizeDirectRisque(input: unknown): DirectRisquePayload {
  const o = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {}
  const gravite = clampInt(o.gravite, 1, 4, 2) as number
  const vraisemblance = clampInt(o.vraisemblance, 1, 4, 2) as number
  const strategie: Strategie = STRATEGIES.includes(String(o.strategie) as Strategie)
    ? (String(o.strategie) as Strategie)
    : 'REDUIRE'
  return {
    nom: String(o.nom ?? '').slice(0, 255),
    gravite,
    vraisemblance,
    niveauRisque: computeRiskScore(gravite, vraisemblance),
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
export function sanitizeDirectRisquePatch(input: unknown): Partial<Omit<DirectRisquePayload, 'niveauRisque'>> {
  const o = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {}
  const out: Partial<Omit<DirectRisquePayload, 'niveauRisque'>> = {}
  if ('nom' in o) out.nom = String(o.nom ?? '').slice(0, 255)
  if ('description' in o) out.description = o.description != null ? String(o.description).slice(0, 2000) : undefined
  if ('strategie' in o) out.strategie = STRATEGIES.includes(String(o.strategie) as Strategie) ? (String(o.strategie) as Strategie) : 'REDUIRE'
  if ('gravite' in o) out.gravite = clampInt(o.gravite, 1, 4, 2) as number
  if ('vraisemblance' in o) out.vraisemblance = clampInt(o.vraisemblance, 1, 4, 2) as number
  return out
}

/** Score de niveau d'un risque (source unique : gravité × vraisemblance). */
export function directNiveau(gravite: number, vraisemblance: number): number {
  return computeRiskScore(gravite, vraisemblance)
}
