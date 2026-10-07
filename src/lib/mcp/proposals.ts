// ─── Propositions MCP — logique PURE (types, assainissement, mapping) ─────────
// Un outil `propose_*` dépose une PROPOSITION (brouillon) ; à l'acceptation en UI,
// on crée l'objet réel via les chemins existants. Ce module (sans base) définit
// les types de propositions, assainit le payload entrant (le contenu fourni par
// l'agent est de la DONNÉE, jamais des instructions) et mappe un payload accepté
// vers les données de création Prisma. Testable sans DB.

import { cleanRisque, cleanMesure } from '@/lib/import-sanitize'
import { sanitizeDirectRisque } from '@/lib/risque-direct'
import { computeRiskScore } from '@/lib/risk-scale'
import { cleanPlanActionInput, type PlanActionInput, type CleanPlanAction } from '@/lib/plan-action'
import { CONFORMITE_STATUTS, type ConformiteStatut } from '@/lib/conformite'

/** Statuts d'une proposition. */
export const PROPOSAL_STATUS = ['EN_ATTENTE', 'ACCEPTEE', 'REJETEE'] as const
export type ProposalStatus = (typeof PROPOSAL_STATUS)[number]

/** Types de propositions supportés (extensible aux phases suivantes). */
export const PROPOSAL_TYPES = ['risk', 'measure', 'plan_action', 'conformite', 'projet360', 'analysis_import', 'analysis_create', 'pssi'] as const
export type ProposalType = (typeof PROPOSAL_TYPES)[number]

/**
 * Types d'ANCRE d'une proposition — un objet concret et existant auquel la
 * proposition se rattache (mêmes origines que le plan d'action unifié /
 * `PlanActionLien`). Une proposition « ne tombe pas du ciel ».
 */
export const PROPOSAL_TARGET_TYPES = ['ANALYSE', 'RISQUE', 'CONFORMITE', 'CONTROLE', 'AUDIT', 'INCIDENT', 'ORGANISATION'] as const
export type ProposalTargetType = (typeof PROPOSAL_TARGET_TYPES)[number]

/** Stratégies de traitement valides (enum Prisma StrategieTraitement). */
export const STRATEGIES = ['REDUIRE', 'ACCEPTER', 'TRANSFERER', 'REFUSER', 'SURVEILLER'] as const
export type Strategie = (typeof STRATEGIES)[number]

/** Mesure et plan d'action portés par une proposition de risque (créés avec le risque à l'acceptation). */
export interface RiskProposalMesure { nom: string; type: MeasureType }
export interface RiskProposalPlan { titre: string; porteur?: string; echeance: string | null; priorite: 'CRITIQUE' | 'MAJEUR' | 'MODERE' }

/** Payload assaini d'une proposition de risque (analyse à saisie directe, projet 360 compris). */
export interface RiskProposalPayload {
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
  /** Domaine projet 360 (CYBER, IT, PROJECT, BUSINESS, FRAUD, OUTSOURCING). */
  domaine?: string
  mesures?: RiskProposalMesure[]
  plans?: RiskProposalPlan[]
}

const MAX_ENFANTS = 10
const PRIORITES_PLAN = ['CRITIQUE', 'MAJEUR', 'MODERE'] as const
const texte = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/**
 * Assainit une proposition de risque fournie par l'agent, comme une saisie directe (`sanitizeDirectRisque`) :
 * cotations bornées à l'échelle de l'organisation (`maxNiveau` : 4 ou 5), actuel ← brut et résiduel ← actuel par
 * défaut, puis **cohérence imposée** (actuel ≤ brut, résiduel ≤ actuel) et niveaux **recalculés** (jamais les valeurs
 * fournies). Domaine 360 connu seulement ; mesures et plans nettoyés et bornés. Ne fait jamais confiance aux entrées.
 */
export function sanitizeRiskProposal(input: unknown, maxNiveau = 4): RiskProposalPayload {
  const obj = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {}
  const d = sanitizeDirectRisque({ ...obj, nom: cleanRisque(obj).nom }, maxNiveau)
  const gA = Math.min(d.graviteActuelle, d.gravite), vA = Math.min(d.vraisemblanceActuelle, d.vraisemblance)
  const gR = Math.min(d.graviteResiduelle, gA), vR = Math.min(d.vraisemblanceResiduelle, vA)
  const mesures = (Array.isArray(obj.mesures) ? obj.mesures : []).flatMap(m => {
    const o = (m && typeof m === 'object') ? m as Record<string, unknown> : {}
    const nom = texte(o.nom, 255)
    return nom ? [{ nom, type: (MEASURE_TYPES as readonly string[]).includes(String(o.type)) ? o.type as MeasureType : 'PREVENTIVE' as const }] : []
  }).slice(0, MAX_ENFANTS)
  const plans = (Array.isArray(obj.plans) ? obj.plans : []).flatMap(pl => {
    const o = (pl && typeof pl === 'object') ? pl as Record<string, unknown> : {}
    const titre = texte(o.titre, 255)
    if (!titre) return []
    const porteur = texte(o.porteur, 120)
    const echeance = typeof o.echeance === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.echeance) && !Number.isNaN(Date.parse(o.echeance)) ? o.echeance : null
    const priorite = (PRIORITES_PLAN as readonly string[]).includes(String(o.priorite)) ? o.priorite as RiskProposalPlan['priorite'] : 'MAJEUR'
    return [{ titre, ...(porteur ? { porteur } : {}), echeance, priorite }]
  }).slice(0, MAX_ENFANTS)
  return {
    nom: d.nom,
    gravite: d.gravite, vraisemblance: d.vraisemblance, niveauRisque: computeRiskScore(d.gravite, d.vraisemblance),
    graviteActuelle: gA, vraisemblanceActuelle: vA, niveauActuel: computeRiskScore(gA, vA),
    graviteResiduelle: gR, vraisemblanceResiduelle: vR, niveauResiduel: computeRiskScore(gR, vR),
    strategie: d.strategie,
    ...(d.description != null ? { description: d.description } : {}),
    ...(d.domaine ? { domaine: d.domaine } : {}),
    ...(mesures.length ? { mesures } : {}),
    ...(plans.length ? { plans } : {}),
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
  const { mesures: _m, plans: _p, ...risque } = payload
  void _m; void _p
  return { analyseId, ...risque }
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
