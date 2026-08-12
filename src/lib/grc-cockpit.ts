// ─── Cockpit GRC consolidé — agrégation cross-module (M2/M3/M4) ──────────────
// Étend le roll-up risque + plan d'action (cf. grc-rollup.ts) aux trois autres
// piliers des 3 lignes de défense, pour une vue « direction / groupe » ACPR :
//   • Incidents & pertes (LDC)   → volume ouvert + perte nette cumulée
//   • Contrôle permanent (M3)    → taux de conformité + anomalies
//   • Audit interne (M4)         → constats critiques + recommandations en retard
// Logique PURE : réutilise perteNette/estTerminal (incident), evaluerEfficacite
// (controle) et synthetiserConstats (audit). Aucune règle métier dupliquée.

import { perteNette, estTerminal, type IncidentStatut } from './incident'
import { evaluerEfficacite } from './controle'
import { synthetiserConstats, type ConstatLite } from './audit'

function groupByOrg<T extends { organizationId: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const r of rows) {
    const arr = m.get(r.organizationId) ?? []
    arr.push(r)
    m.set(r.organizationId, arr)
  }
  return m
}

// ─── Incidents & pertes (M2 / LDC) ───────────────────────────────────────────

export interface CockpitIncident {
  organizationId: string
  statut: IncidentStatut
  montantBrut: number | null
  recuperations: number | null
}

export interface IncidentTotals {
  total: number // incidents retenus (les REJETE sont exclus : faux positifs)
  ouverts: number // non terminaux (DECLARE + QUALIFIE)
  perteNette: number // € cumulés, net des récupérations (hors REJETE)
}

export function rollupIncidents(rows: CockpitIncident[]): IncidentTotals {
  const t: IncidentTotals = { total: 0, ouverts: 0, perteNette: 0 }
  for (const i of rows) {
    if (i.statut === 'REJETE') continue
    t.total++
    if (!estTerminal(i.statut)) t.ouverts++
    t.perteNette += perteNette(i.montantBrut, i.recuperations) ?? 0
  }
  t.perteNette = Math.round(t.perteNette * 100) / 100
  return t
}

export function incidentsByOrg(rows: CockpitIncident[]): Map<string, IncidentTotals> {
  const out = new Map<string, IncidentTotals>()
  for (const [org, arr] of groupByOrg(rows)) out.set(org, rollupIncidents(arr))
  return out
}

// ─── Contrôle permanent (M3) ─────────────────────────────────────────────────

export interface CockpitControle {
  organizationId: string
}

export interface CockpitExecution {
  organizationId: string
  resultat: string
  dateRealisation: Date | string
}

export interface ControleTotals {
  controles: number // contrôles actifs
  evaluees: number // exécutions évaluables (hors NON_APPLICABLE)
  conformes: number
  anomalies: number
  tauxConformite: number | null // % ; null si aucune exécution évaluable
}

export function rollupControles(controles: CockpitControle[], execs: CockpitExecution[]): ControleTotals {
  const eff = evaluerEfficacite(execs) // même calcul que l'efficacité d'un contrôle isolé
  return {
    controles: controles.length,
    evaluees: eff.evaluees,
    conformes: eff.conformes,
    anomalies: eff.anomalies,
    tauxConformite: eff.tauxConformite,
  }
}

export function controlesByOrg(controles: CockpitControle[], execs: CockpitExecution[]): Map<string, ControleTotals> {
  const cg = groupByOrg(controles)
  const eg = groupByOrg(execs)
  const out = new Map<string, ControleTotals>()
  for (const org of new Set([...cg.keys(), ...eg.keys()])) {
    out.set(org, rollupControles(cg.get(org) ?? [], eg.get(org) ?? []))
  }
  return out
}

// ─── Audit interne (M4) ──────────────────────────────────────────────────────

export interface CockpitConstat extends ConstatLite {
  organizationId: string
}

export interface AuditTotals {
  missions: number
  constats: number
  critiques: number // criticité max non terminée
  recosEnRetard: number // échéance dépassée, non terminée
  tauxResolution: number // % de constats terminés
}

export function rollupAudit(missions: { organizationId: string }[], constats: CockpitConstat[], now: Date): AuditTotals {
  const s = synthetiserConstats(constats, now)
  return {
    missions: missions.length,
    constats: s.total,
    critiques: s.critiques,
    recosEnRetard: s.enRetard,
    tauxResolution: s.tauxResolution,
  }
}

export function auditByOrg(missions: { organizationId: string }[], constats: CockpitConstat[], now: Date): Map<string, AuditTotals> {
  const mg = groupByOrg(missions)
  const cg = groupByOrg(constats)
  const out = new Map<string, AuditTotals>()
  for (const org of new Set([...mg.keys(), ...cg.keys()])) {
    out.set(org, rollupAudit(mg.get(org) ?? [], cg.get(org) ?? [], now))
  }
  return out
}
