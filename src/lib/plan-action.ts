/**
 * plan-action.ts — Plan d'action UNIFIÉ (objet de premier plan). Module PUR.
 *
 * Un plan d'action peut répondre à PLUSIEURS sources à la fois via des liens
 * polymorphes : analyse de risque, suivi de conformité, contrôle permanent,
 * audit, risque (registre), incident. Le statut/priorité réutilise la logique
 * canonique de risk-action.ts (retard dérivé de l'échéance).
 */
import { cleanPriorite, RISK_ACTION_STATUTS, type ActionPriorite, type RiskActionStatut } from './risk-action'

export const PLAN_ACTION_LIEN_TYPES = ['ANALYSE', 'CONFORMITE', 'CONTROLE', 'AUDIT', 'RISQUE', 'INCIDENT'] as const
/** Type de lien polymorphe d'un plan d'action vers son origine : analyse, conformité, contrôle, audit, risque ou incident. */
export type PlanActionLienType = (typeof PLAN_ACTION_LIEN_TYPES)[number]
export const isLienType = (v: unknown): v is PlanActionLienType =>
  typeof v === 'string' && (PLAN_ACTION_LIEN_TYPES as readonly string[]).includes(v)

/** Lien polymorphe rattachant un plan d'action à une origine (type + identifiant de l'objet source). */
export interface PlanActionLien {
  type: PlanActionLienType
  targetId: string
  ref?: string
  label?: string
}

/** Nettoie un lien (type connu, targetId non vide, champs bornés) ou renvoie null. */
export function sanitizeLien(raw: unknown): PlanActionLien | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!isLienType(o.type)) return null
  const targetId = typeof o.targetId === 'string' ? o.targetId.trim().slice(0, 200) : ''
  if (!targetId) return null
  const lien: PlanActionLien = { type: o.type, targetId }
  if (typeof o.ref === 'string' && o.ref.trim()) lien.ref = o.ref.trim().slice(0, 80)
  if (typeof o.label === 'string' && o.label.trim()) lien.label = o.label.trim().slice(0, 200)
  return lien
}

/** Nettoie et dédoublonne une liste de liens (clé = type|targetId|ref). */
export function sanitizeLiens(raw: unknown): PlanActionLien[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: PlanActionLien[] = []
  for (const r of raw) {
    const l = sanitizeLien(r)
    if (!l) continue
    const key = `${l.type}|${l.targetId}|${l.ref ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(l)
  }
  return out.slice(0, 100)
}

/** Lien profond vers la fiche source d'un lien (best-effort). */
export function lienHref(lien: PlanActionLien): string {
  const id = encodeURIComponent(lien.targetId)
  switch (lien.type) {
    case 'ANALYSE': return `/analyses/${id}`
    case 'RISQUE': return `/registre?item=${id}`
    case 'CONFORMITE': return `/conformite/socle?ref=${id}`
    case 'CONTROLE': return `/controle-permanent?controle=${id}`
    case 'AUDIT': return `/audit?mission=${id}`
    case 'INCIDENT': return `/incidents?incident=${id}`
  }
}

// ─── Absorption de RiskAction ────────────────────────────────────────────────
// Le registre de risques rattache ses actions via un lien RISQUE (targetId =
// riskItemId). Ces helpers PURS relient le store unifié PlanAction au contrat
// historique du panneau registre, sans dupliquer la logique côté serveur.

type LienLike = { type: string; targetId: string }

/** riskItemId porté par le 1ᵉʳ lien RISQUE d'un plan d'action, ou null. */
export function riskItemIdFromLiens(liens: readonly LienLike[] | null | undefined): string | null {
  if (!Array.isArray(liens)) return null
  const l = liens.find(x => x?.type === 'RISQUE' && typeof x.targetId === 'string' && x.targetId)
  return l ? l.targetId : null
}

/** Forme d'une action de risque absorbée dans le plan d'action unifié (compatibilité RiskAction). */
export interface RiskActionShape {
  id: string
  intitule: string
  description: string | null
  responsable: string | null
  echeance: Date | null
  statut: string
  priorite: string
}

/** Projette un PlanAction vers la forme RiskAction attendue par le panneau registre. */
export function toRiskActionShape(p: {
  id: string; titre: string; description: string | null; porteur: string | null
  echeance: Date | null; statut: string; priorite: string
}): RiskActionShape {
  return {
    id: p.id,
    intitule: p.titre,
    description: p.description ?? null,
    responsable: p.porteur ?? null,
    echeance: p.echeance ?? null,
    statut: p.statut,
    priorite: p.priorite,
  }
}

/** Entrée brute (non validée) d'un plan d'action unifié, telle que reçue de l'API. */
export interface PlanActionInput {
  titre?: unknown
  description?: unknown
  porteur?: unknown
  entite?: unknown
  echeance?: unknown
  priorite?: unknown
  statut?: unknown
}

/** Entrée d'un plan d'action normalisée (statut typé, textes tronqués, échéance), prête pour la persistance. */
export interface CleanPlanAction {
  titre: string
  description: string | null
  porteur: string | null
  entite: string | null
  echeance: string | null
  priorite: ActionPriorite
  statut: RiskActionStatut
}

/** Renvoie un message d'erreur si l'entrée est invalide, sinon null. */
export function validatePlanActionInput(body: PlanActionInput): string | null {
  const titre = typeof body?.titre === 'string' ? body.titre.trim() : ''
  if (!titre) return 'titre_requis'
  if (body?.statut != null && !(RISK_ACTION_STATUTS as readonly string[]).includes(String(body.statut))) return 'statut_invalide'
  return null
}

/** Normalise l'entrée d'un plan d'action unifié (textes trim/tronqués, statut typé avec défaut A_FAIRE, échéance). */
export function cleanPlanActionInput(body: PlanActionInput): CleanPlanAction {
  const s = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null)
  const statut = (RISK_ACTION_STATUTS as readonly string[]).includes(String(body?.statut)) ? (body!.statut as RiskActionStatut) : 'A_FAIRE'
  const ech = typeof body?.echeance === 'string' && body.echeance ? body.echeance : null
  return {
    titre: String(body.titre).trim().slice(0, 200),
    description: s(body?.description, 4000),
    porteur: s(body?.porteur, 120),
    entite: s(body?.entite, 120),
    echeance: ech,
    priorite: cleanPriorite(body?.priorite),
    statut,
  }
}
