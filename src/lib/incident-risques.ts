// ─── Incident ↔ risques du registre (plusieurs) — PUR ─────────────────────────
// Un incident se rattache le plus souvent à un ou plusieurs risques EXISTANTS du registre (table IncidentRisque) ;
// `Incident.riskItemId` reste le risque principal (le premier associé) pour les usages historiques.
// Testé : incident-risques.test.ts.
import type { IncidentLite } from '@/lib/incident'

export const MAX_RISQUES_PAR_INCIDENT = 20

export function normaliserRisqueIds(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return [...new Set(v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map(x => x.trim()))].slice(0, MAX_RISQUES_PAR_INCIDENT)
}

/** Risques demandés par le corps d'une requête : `riskItemIds` (liste), sinon l'ancien `riskItemId` ; null = non fourni. */
export function risquesDepuisCorps(body: Record<string, unknown>): string[] | null {
  if ('riskItemIds' in body) return normaliserRisqueIds(body.riskItemIds)
  if ('riskItemId' in body) return typeof body.riskItemId === 'string' && body.riskItemId ? [body.riskItemId] : []
  return null
}

/** Une observation par risque lié (calibrage par la fréquence observée). */
export function incidentsParRisque(incidents: readonly (Omit<IncidentLite, 'riskItemId'> & { riskItemIds: readonly string[] })[]): IncidentLite[] {
  return incidents.flatMap(({ riskItemIds, ...i }) => riskItemIds.map(riskItemId => ({ ...i, riskItemId })))
}
