// ─── Plans d'action unifiés ──────────────────────────────────────────────────
// Les « actions » de l'organisation vivent aujourd'hui dans quatre modules :
//   • mesures de traitement d'une analyse EBIOS (Mesure)
//   • actions de traitement du registre GRC (RiskAction)
//   • recommandations d'audit (AuditConstat)
//   • anomalies de contrôle permanent (ControleExecution résultat=ANOMALIE)
//   • remédiation d'incidents ouverts (Incident)
// Par nature c'est le même objet : une chose à faire, portée par quelqu'un, avec
// une échéance et une priorité. Cette lib PURE normalise chaque source vers un
// `ActionItem` canonique et fournit filtre/tri/synthèse. Aucune dépendance DB :
// la couche serveur charge les lignes + construit les liens, puis appelle ces
// normaliseurs. Le retard n'est jamais stocké — il se dérive de l'échéance
// (cf. effectiveStatut / summarizeActions de risk-action.ts, réutilisés ici).

import {
  type ActionPriorite,
  type RiskActionStatut,
  type ActionsSummary,
  summarizeActions,
} from './risk-action'

export const ACTION_SOURCES = ['MESURE', 'RISK_ACTION', 'AUDIT', 'CONTROLE', 'INCIDENT'] as const
export type ActionSource = (typeof ACTION_SOURCES)[number]

/** Objet canonique d'un plan d'action, quelle que soit sa source d'origine. */
export interface ActionItem {
  id: string // `${source}:${sourceId}` — stable et unique dans la vue agrégée
  source: ActionSource
  sourceId: string
  titre: string
  description: string | null
  porteur: string | null // personne/équipe responsable
  entite: string | null // direction/entité de rattachement
  echeance: Date | null
  statut: RiskActionStatut // canonique A_FAIRE | EN_COURS | FAIT (retard dérivé)
  priorite: ActionPriorite // CRITIQUE | MAJEUR | MODERE
  lien: string | null // lien profond vers la fiche source
  riskItemId: string | null // rattachement éventuel au registre canonique
}

interface LienOpt { lien?: string | null }

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}
function toDate(v: unknown): Date | null {
  if (v == null || v === '') return null
  const d = v instanceof Date ? v : new Date(v as string)
  return Number.isNaN(d.getTime()) ? null : d
}

// ─── Mapping des priorités ───────────────────────────────────────────────────
// Mesure : Int 1-4 où 1 = plus prioritaire, défaut 2 (= MAJEUR, cohérent avec le
// registre). Audit/Incident : Int 1-4 où 4 = plus critique (CRITICITE_MAX).

export function mapMesurePriorite(n: unknown): ActionPriorite {
  const v = Number(n)
  if (!Number.isFinite(v) || v < 1) return 'MAJEUR'
  if (v <= 1) return 'CRITIQUE'
  if (v <= 2) return 'MAJEUR'
  return 'MODERE'
}

export function mapCriticitePriorite(n: unknown): ActionPriorite {
  const v = Number(n)
  if (!Number.isFinite(v) || v < 1) return 'MAJEUR'
  if (v >= 4) return 'CRITIQUE'
  if (v >= 3) return 'MAJEUR'
  return 'MODERE'
}

// ─── Normaliseurs par source ─────────────────────────────────────────────────

export interface MesureRow {
  id: string; nom: string; statut?: unknown; priorite?: unknown
  responsable?: unknown; entite?: unknown; echeance?: unknown; risqueId?: unknown
  description?: unknown
}
export function normalizeMesure(row: MesureRow, opt: LienOpt = {}): ActionItem {
  const statut: RiskActionStatut =
    row.statut === 'REALISE' ? 'FAIT' : row.statut === 'EN_COURS' ? 'EN_COURS' : 'A_FAIRE'
  return {
    id: `MESURE:${row.id}`, source: 'MESURE', sourceId: row.id,
    titre: row.nom, description: str(row.description),
    porteur: str(row.responsable) ?? str(row.entite), entite: str(row.entite),
    echeance: toDate(row.echeance), statut, priorite: mapMesurePriorite(row.priorite),
    lien: opt.lien ?? null, riskItemId: null,
  }
}

export interface RiskActionRow {
  id: string; intitule: string; description?: unknown; responsable?: unknown
  echeance?: unknown; statut?: unknown; priorite?: unknown; riskItemId?: unknown
  entite?: unknown
}
export function normalizeRiskAction(row: RiskActionRow, opt: LienOpt = {}): ActionItem {
  const statut: RiskActionStatut =
    row.statut === 'FAIT' ? 'FAIT' : row.statut === 'EN_COURS' ? 'EN_COURS' : 'A_FAIRE'
  const priorite: ActionPriorite =
    row.priorite === 'CRITIQUE' ? 'CRITIQUE' : row.priorite === 'MODERE' ? 'MODERE' : 'MAJEUR'
  return {
    id: `RISK_ACTION:${row.id}`, source: 'RISK_ACTION', sourceId: row.id,
    titre: row.intitule, description: str(row.description),
    porteur: str(row.responsable), entite: str(row.entite),
    echeance: toDate(row.echeance), statut, priorite,
    lien: opt.lien ?? null, riskItemId: str(row.riskItemId),
  }
}

export interface AuditConstatRow {
  id: string; intitule: string; recommandation?: unknown; criticite?: unknown
  statut?: unknown; responsableAction?: unknown; echeance?: unknown; riskItemId?: unknown
}
export function normalizeAuditConstat(row: AuditConstatRow, opt: LienOpt = {}): ActionItem {
  const statut: RiskActionStatut =
    row.statut === 'RESOLU' || row.statut === 'ACCEPTE' ? 'FAIT'
      : row.statut === 'EN_COURS' ? 'EN_COURS' : 'A_FAIRE'
  return {
    id: `AUDIT:${row.id}`, source: 'AUDIT', sourceId: row.id,
    titre: row.intitule, description: str(row.recommandation),
    porteur: str(row.responsableAction), entite: null,
    echeance: toDate(row.echeance), statut, priorite: mapCriticitePriorite(row.criticite),
    lien: opt.lien ?? null, riskItemId: str(row.riskItemId),
  }
}

export interface ControleAnomalieRow {
  id: string; controleNom: string; constat?: unknown; dateRealisation?: unknown
  responsable?: unknown; entite?: unknown
}
export function normalizeControleAnomalie(row: ControleAnomalieRow, opt: LienOpt = {}): ActionItem {
  return {
    id: `CONTROLE:${row.id}`, source: 'CONTROLE', sourceId: row.id,
    titre: `${row.controleNom} — anomalie`, description: str(row.constat),
    porteur: str(row.responsable), entite: str(row.entite),
    echeance: toDate(row.dateRealisation), statut: 'A_FAIRE', priorite: 'MAJEUR',
    lien: opt.lien ?? null, riskItemId: null,
  }
}

export interface IncidentRow {
  id: string; intitule: string; statut?: unknown; impactEstime?: unknown
  entite?: unknown; echeance?: unknown; riskItemId?: unknown; description?: unknown
}
/** Renvoie null pour un incident REJETE (hors plans d'action). */
export function normalizeIncident(row: IncidentRow, opt: LienOpt = {}): ActionItem | null {
  if (row.statut === 'REJETE') return null
  const statut: RiskActionStatut =
    row.statut === 'CLOTURE' ? 'FAIT' : row.statut === 'QUALIFIE' ? 'EN_COURS' : 'A_FAIRE'
  return {
    id: `INCIDENT:${row.id}`, source: 'INCIDENT', sourceId: row.id,
    titre: row.intitule, description: str(row.description),
    porteur: str(row.entite), entite: str(row.entite),
    echeance: toDate(row.echeance), statut, priorite: mapCriticitePriorite(row.impactEstime),
    lien: opt.lien ?? null, riskItemId: str(row.riskItemId),
  }
}

// ─── Filtre / tri / synthèse ─────────────────────────────────────────────────

export interface ActionItemFiltre {
  source?: ActionSource
  priorite?: ActionPriorite
  statut?: RiskActionStatut | 'EN_RETARD'
  porteur?: string
  q?: string
}

import { effectiveStatut } from './risk-action'

export function filterActionItems(items: ActionItem[], f: ActionItemFiltre, now: Date): ActionItem[] {
  const porteur = f.porteur?.trim().toLowerCase()
  const q = f.q?.trim().toLowerCase()
  return items.filter((it) => {
    if (f.source && it.source !== f.source) return false
    if (f.priorite && it.priorite !== f.priorite) return false
    if (f.statut && effectiveStatut(it, now) !== f.statut) return false
    if (porteur && !((it.porteur ?? '').toLowerCase().includes(porteur) || (it.entite ?? '').toLowerCase().includes(porteur))) return false
    if (q && !(it.titre.toLowerCase().includes(q) || (it.description ?? '').toLowerCase().includes(q))) return false
    return true
  })
}

const PRIORITE_ORDRE: Record<ActionPriorite, number> = { CRITIQUE: 0, MAJEUR: 1, MODERE: 2 }

/** Tri : retards d'abord, puis priorité décroissante, puis échéance croissante (nulls en fin). */
export function sortActionItems(items: ActionItem[], now: Date): ActionItem[] {
  return [...items].sort((a, b) => {
    const ra = effectiveStatut(a, now) === 'EN_RETARD' ? 0 : 1
    const rb = effectiveStatut(b, now) === 'EN_RETARD' ? 0 : 1
    if (ra !== rb) return ra - rb
    if (PRIORITE_ORDRE[a.priorite] !== PRIORITE_ORDRE[b.priorite]) return PRIORITE_ORDRE[a.priorite] - PRIORITE_ORDRE[b.priorite]
    const ea = a.echeance ? a.echeance.getTime() : Infinity
    const eb = b.echeance ? b.echeance.getTime() : Infinity
    return ea - eb
  })
}

export function summarizeActionItems(items: ActionItem[], now: Date): ActionsSummary {
  return summarizeActions(items, now)
}
