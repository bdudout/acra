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
import { synthetiserConstats, niveauControle, type ConstatLite } from './audit'

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
  niveau?: string // N1 | N2 (facultatif : segmentation du reporting)
}

export interface CockpitExecution {
  organizationId: string
  resultat: string
  dateRealisation: Date | string
  niveau?: string // niveau du contrôle parent (facultatif)
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

/** Rollup du contrôle permanent segmenté par niveau (N1 = 1ʳᵉ ligne, N2 = 2ᵉ ligne). */
export function rollupControlesParNiveau(controles: CockpitControle[], execs: CockpitExecution[]): Record<'N1' | 'N2', ControleTotals> {
  const filtre = (n: 'N1' | 'N2') => ({
    c: controles.filter(x => (x.niveau ?? 'N1') === n),
    e: execs.filter(x => (x.niveau ?? 'N1') === n),
  })
  const n1 = filtre('N1'), n2 = filtre('N2')
  return { N1: rollupControles(n1.c, n1.e), N2: rollupControles(n2.c, n2.e) }
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

// ─── Suivi consolidé des 4 niveaux de contrôle ───────────────────────────────
// N1 : contrôle permanent 1ʳᵉ ligne · N2 : contrôle permanent 2ᵉ ligne ·
// N3 : audit interne (contrôle périodique) · N4 : contrôle externe (autorité de
// contrôle / auditeur externe). Réutilise les rollups par niveau et la synthèse
// de constats — aucune règle métier dupliquée.

export type NiveauControleGlobal = 'N1' | 'N2' | 'N3' | 'N4'
export interface NiveauSuivi {
  niveau: NiveauControleGlobal
  activite: number   // nombre d'objets pilotés (contrôles ou constats) au niveau
  attention: number  // points d'attention : anomalies (N1/N2) ou constats ouverts (N3/N4)
  enRetard: number   // constats en retard d'échéance (N3/N4 ; 0 pour le contrôle permanent)
}

/** Synthèse des 4 niveaux de contrôle pour le cockpit (pure, testée). */
export function synthetiserQuatreNiveaux(
  input: { n1: ControleTotals; n2: ControleTotals; constats: (ConstatLite & { source: string })[] },
  now: Date = new Date(),
): NiveauSuivi[] {
  const s3 = synthetiserConstats(input.constats.filter(c => niveauControle(c.source) === 'N3'), now)
  const s4 = synthetiserConstats(input.constats.filter(c => niveauControle(c.source) === 'N4'), now)
  return [
    { niveau: 'N1', activite: input.n1.controles, attention: input.n1.anomalies, enRetard: 0 },
    { niveau: 'N2', activite: input.n2.controles, attention: input.n2.anomalies, enRetard: 0 },
    { niveau: 'N3', activite: s3.total, attention: s3.ouverts, enRetard: s3.enRetard },
    { niveau: 'N4', activite: s4.total, attention: s4.ouverts, enRetard: s4.enRetard },
  ]
}
