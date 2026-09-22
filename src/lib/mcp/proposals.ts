// ─── Propositions MCP — logique PURE (types, assainissement, mapping) ─────────
// Un outil `propose_*` dépose une PROPOSITION (brouillon) ; à l'acceptation en UI,
// on crée l'objet réel via les chemins existants. Ce module (sans base) définit
// les types de propositions, assainit le payload entrant (le contenu fourni par
// l'agent est de la DONNÉE, jamais des instructions) et mappe un payload accepté
// vers les données de création Prisma. Testable sans DB.

import { cleanRisque, cleanMesure } from '@/lib/import-sanitize'
import { cleanPlanActionInput, type PlanActionInput, type CleanPlanAction } from '@/lib/plan-action'
import { CONFORMITE_STATUTS, type ConformiteStatut } from '@/lib/conformite'

/** Statuts d'une proposition. */
export const PROPOSAL_STATUS = ['EN_ATTENTE', 'ACCEPTEE', 'REJETEE'] as const
export type ProposalStatus = (typeof PROPOSAL_STATUS)[number]

/** Types de propositions supportés (extensible aux phases suivantes). */
export const PROPOSAL_TYPES = ['risk', 'measure', 'plan_action', 'conformite'] as const
export type ProposalType = (typeof PROPOSAL_TYPES)[number]

/**
 * Types d'ANCRE d'une proposition — un objet concret et existant auquel la
 * proposition se rattache (mêmes origines que le plan d'action unifié /
 * `PlanActionLien`). Une proposition « ne tombe pas du ciel ».
 */
export const PROPOSAL_TARGET_TYPES = ['ANALYSE', 'RISQUE', 'CONFORMITE', 'CONTROLE', 'AUDIT', 'INCIDENT'] as const
export type ProposalTargetType = (typeof PROPOSAL_TARGET_TYPES)[number]

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

// ── Propositions de MESURE (atelier 5 — traitement) ──────────────────────────

/** Types de mesure valides (enum Prisma TypeMesure). */
export const MEASURE_TYPES = ['PREVENTIVE', 'DETECTIVE', 'CORRECTIVE', 'DISSUASIVE', 'ORGANISATIONNELLE', 'TECHNIQUE'] as const
export type MeasureType = (typeof MEASURE_TYPES)[number]
/** Statuts de mesure valides (enum Prisma StatutMesure). */
export const MEASURE_STATUS = ['A_FAIRE', 'EN_COURS', 'REALISE', 'REPORTE'] as const
export type MeasureStatus = (typeof MEASURE_STATUS)[number]

/** Payload assaini d'une proposition de mesure (échéance sérialisée en ISO). */
export interface MeasureProposalPayload {
  nom: string
  type: MeasureType
  priorite: number
  statut: MeasureStatus
  description?: string
  responsable?: string
  entite?: string
  echeance?: string // ISO 8601 (JSON-sérialisable)
  cout?: string
  efficacite?: number
}

/**
 * Assainit une proposition de mesure : réutilise `cleanMesure` (troncatures/clamps),
 * normalise `type`/`statut` vers leurs enums (défauts PREVENTIVE / A_FAIRE) et
 * sérialise l'échéance en ISO (stockage JSON). Ne fait jamais confiance aux entrées.
 */
export function sanitizeMeasureProposal(input: unknown): MeasureProposalPayload {
  const obj = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {}
  const c = cleanMesure(obj)
  const type: MeasureType = MEASURE_TYPES.includes(String(c.type) as MeasureType) ? (String(c.type) as MeasureType) : 'PREVENTIVE'
  const statut: MeasureStatus = MEASURE_STATUS.includes(String(c.statut) as MeasureStatus) ? (String(c.statut) as MeasureStatus) : 'A_FAIRE'
  const echeance = c.echeance instanceof Date && !Number.isNaN(c.echeance.getTime()) ? c.echeance.toISOString() : undefined
  return {
    nom: c.nom as string,
    type,
    priorite: c.priorite as number,
    statut,
    ...(c.description != null ? { description: c.description as string } : {}),
    ...(c.responsable != null ? { responsable: c.responsable as string } : {}),
    ...(c.entite != null ? { entite: c.entite as string } : {}),
    ...(echeance ? { echeance } : {}),
    ...(c.cout != null ? { cout: c.cout as string } : {}),
    ...(c.efficacite != null ? { efficacite: c.efficacite as number } : {}),
  }
}

/** Vrai si la proposition de mesure est exploitable (nom requis). */
export function isMeasureProposalValid(p: MeasureProposalPayload): boolean {
  return p.nom.trim().length > 0
}

// ── Propositions de PLAN D'ACTION (org-scopé, ancré à une origine) ───────────

/** Payload assaini d'une proposition de plan d'action (réutilise le nettoyeur unifié). */
export type PlanActionProposalPayload = CleanPlanAction

/** Assainit une proposition de plan d'action (titre requis, champs tronqués/normalisés). */
export function sanitizePlanActionProposal(input: unknown): PlanActionProposalPayload {
  const obj = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {}
  const titre = typeof obj.titre === 'string' ? obj.titre : ''
  return cleanPlanActionInput({ ...(obj as PlanActionInput), titre })
}

/** Vrai si la proposition de plan d'action est exploitable (titre requis). */
export function isPlanActionProposalValid(p: PlanActionProposalPayload): boolean {
  return typeof p.titre === 'string' && p.titre.trim().length > 0
}

/**
 * Mappe un payload de plan d'action ACCEPTÉ vers les données Prisma `PlanAction`,
 * avec le **lien polymorphe** vers l'ancre (`type` = targetType, `targetId`).
 */
export function planActionProposalToCreate(
  p: PlanActionProposalPayload, organizationId: string, targetType: string, targetId: string, createdById: string,
) {
  return {
    organizationId,
    titre: p.titre,
    description: p.description,
    porteur: p.porteur,
    entite: p.entite,
    echeance: p.echeance ? new Date(p.echeance) : null,
    priorite: p.priorite,
    statut: p.statut,
    createdById,
    liens: { create: [{ type: targetType, targetId }] },
  }
}

// ── Propositions de CONFORMITÉ (statut d'un contrôle, ancré à un référentiel) ─

/**
 * Payload assaini d'une proposition de conformité : un nouveau STATUT (+ commentaire)
 * pour un contrôle (`ref`) d'un référentiel de conformité (ancre CONFORMITE). La
 * proposition ne modifie rien : à l'acceptation, le statut est appliqué aux entrées
 * du `Conformite` cible via `applyConformiteEntry`.
 */
export interface ConformiteProposalPayload {
  ref: string
  statut: ConformiteStatut
  commentaire?: string
}

/** Assainit une proposition de conformité : `ref` borné, `statut` validé, commentaire borné. */
export function sanitizeConformiteProposal(input: unknown): ConformiteProposalPayload {
  const obj = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {}
  const ref = (typeof obj.ref === 'string' ? obj.ref : '').trim().slice(0, 120)
  const rawStatut = typeof obj.statut === 'string' ? obj.statut : ''
  // Statut invalide → chaîne vide : `isConformiteProposalValid` rejette (pas de défaut trompeur).
  const statut = ((CONFORMITE_STATUTS as string[]).includes(rawStatut) ? rawStatut : '') as ConformiteStatut
  const commentaire = typeof obj.commentaire === 'string' ? obj.commentaire.trim().slice(0, 1000) : ''
  return { ref, statut, ...(commentaire ? { commentaire } : {}) }
}

/** Vrai si la proposition de conformité est exploitable (ref non vide + statut connu). */
export function isConformiteProposalValid(p: ConformiteProposalPayload): boolean {
  return p.ref.trim().length > 0 && (CONFORMITE_STATUTS as string[]).includes(p.statut)
}

/** Mappe un payload de proposition de mesure ACCEPTÉ vers les données Prisma `Mesure`. */
export function measureProposalToCreate(payload: MeasureProposalPayload, analyseId: string) {
  return {
    analyseId,
    nom: payload.nom,
    type: payload.type,
    priorite: payload.priorite,
    statut: payload.statut,
    ...(payload.description != null ? { description: payload.description } : {}),
    ...(payload.responsable != null ? { responsable: payload.responsable } : {}),
    ...(payload.entite != null ? { entite: payload.entite } : {}),
    ...(payload.echeance ? { echeance: new Date(payload.echeance) } : {}),
    ...(payload.cout != null ? { cout: payload.cout } : {}),
    ...(payload.efficacite != null ? { efficacite: payload.efficacite } : {}),
  }
}
