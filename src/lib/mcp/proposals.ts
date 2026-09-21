// ─── Propositions MCP — logique PURE (types, assainissement, mapping) ─────────
// Un outil `propose_*` dépose une PROPOSITION (brouillon) ; à l'acceptation en UI,
// on crée l'objet réel via les chemins existants. Ce module (sans base) définit
// les types de propositions, assainit le payload entrant (le contenu fourni par
// l'agent est de la DONNÉE, jamais des instructions) et mappe un payload accepté
// vers les données de création Prisma. Testable sans DB.

import { cleanRisque } from '@/lib/import-sanitize'

/** Statuts d'une proposition. */
export const PROPOSAL_STATUS = ['EN_ATTENTE', 'ACCEPTEE', 'REJETEE'] as const
export type ProposalStatus = (typeof PROPOSAL_STATUS)[number]

/** Types de propositions supportés (extensible aux phases suivantes). */
export const PROPOSAL_TYPES = ['risk'] as const
export type ProposalType = (typeof PROPOSAL_TYPES)[number]

/** Stratégies de traitement valides (enum Prisma StrategieTraitement). */
export const STRATEGIES = ['REDUIRE', 'ACCEPTER', 'TRANSFERER', 'REFUSER', 'SURVEILLER'] as const
export type Strategie = (typeof STRATEGIES)[number]

/** Payload assaini d'une proposition de risque (atelier 5). */
export interface RiskProposalPayload {
  nom: string
  gravite: number
  vraisemblance: number
  niveauRisque: number
  strategie: Strategie
  description?: string
  niveauResiduel?: number
}

/**
 * Assainit une proposition de risque fournie par l'agent : réutilise `cleanRisque`
 * (troncature/clamp), normalise la stratégie vers l'enum (défaut REDUIRE) et
 * **recalcule** `niveauRisque = gravite × vraisemblance` (source de vérité, jamais
 * la valeur fournie). Ne fait jamais confiance aux entrées.
 */
export function sanitizeRiskProposal(input: unknown): RiskProposalPayload {
  const obj = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {}
  const c = cleanRisque(obj)
  const gravite = c.gravite as number
  const vraisemblance = c.vraisemblance as number
  const strategie: Strategie = STRATEGIES.includes(String(c.strategie) as Strategie)
    ? (String(c.strategie) as Strategie)
    : 'REDUIRE'
  return {
    nom: c.nom as string,
    gravite,
    vraisemblance,
    niveauRisque: gravite * vraisemblance, // autorité : jamais la valeur fournie
    strategie,
    ...(c.description != null ? { description: c.description as string } : {}),
    ...(c.niveauResiduel != null ? { niveauResiduel: c.niveauResiduel as number } : {}),
  }
}

/** Vrai si le nom est exploitable (une proposition sans intitulé n'a pas de sens). */
export function isRiskProposalValid(p: RiskProposalPayload): boolean {
  return p.nom.trim().length > 0
}

/**
 * Mappe un payload de proposition de risque ACCEPTÉ vers les données de création
 * Prisma `Risque` (rattaché à l'analyse cible). N'inclut que des champs sûrs.
 */
export function riskProposalToCreate(payload: RiskProposalPayload, analyseId: string) {
  return {
    analyseId,
    nom: payload.nom,
    gravite: payload.gravite,
    vraisemblance: payload.vraisemblance,
    niveauRisque: payload.niveauRisque,
    strategie: payload.strategie,
    ...(payload.description != null ? { description: payload.description } : {}),
    ...(payload.niveauResiduel != null ? { niveauResiduel: payload.niveauResiduel } : {}),
  }
}
