/**
 * incident-vue.ts — Vue calculée d'un incident (lot L1) : horloges de notification,
 * totaux de pertes convertis, seuils, ventilation par type. Module PUR (l'API l'appelle
 * pour chaque incident ; l'UI n'a plus qu'à afficher).
 */

import { calculerHorloges, sanitizeAttributs, sanitizeNotifications, type HorlogeRegime } from './notification-regimes'
import { sanitizePertes, sanitizeRecuperations, totauxPertes, evaluerSeuils, pertesParType, type TotauxPertes } from './pertes'
import type { IncidentsConfig } from './incidents-config'

export interface IncidentVueInput {
  dateDetection: Date | null; createdAt: Date; quasiIncident: boolean
  attributs: unknown; notifications: unknown; pertes: unknown; recuperationsLignes: unknown
}
export interface IncidentVue {
  horloges: HorlogeRegime[]
  nbEnRetard: number
  totaux: TotauxPertes
  seuils: { collectee: boolean; grandePerte: boolean }
  parType: Record<string, number>
}

/** « Connaissance » de l'incident = détection ; à défaut, sa déclaration dans l'outil. */
export function vueIncidentL1(row: IncidentVueInput, cfg: IncidentsConfig, now: Date): IncidentVue {
  const horloges = calculerHorloges(
    { connaissance: row.dateDetection ?? row.createdAt, attributs: sanitizeAttributs(row.attributs), notifications: sanitizeNotifications(row.notifications) },
    cfg.regimes, now,
  )
  const pertes = row.quasiIncident ? [] : sanitizePertes(row.pertes, cfg.deviseReference)
  const recups = row.quasiIncident ? [] : sanitizeRecuperations(row.recuperationsLignes, cfg.deviseReference)
  const totaux = totauxPertes(pertes, recups, cfg)
  return {
    horloges,
    nbEnRetard: horloges.reduce((n, h) => n + h.phases.filter(p => p.statut === 'EN_RETARD').length, 0),
    totaux,
    seuils: evaluerSeuils(totaux.net, cfg),
    parType: pertesParType(pertes, cfg),
  }
}

// ─── Export LDC : colonnes du lot L1 ─────────────────────────────────────────

/** En-têtes ajoutés à l'export LDC : type, quasi-incident, règlement, devise, ventilation par type de perte actif. */
export function enTetesLdcL1(cfg: IncidentsConfig): string[] {
  return ['typeEvenement', 'quasiIncident', 'dateReglement', 'devise', ...cfg.typesPerte.filter(x => x.actif).map(x => `perte_${x.code}`)]
}

/** Valeurs des colonnes L1 pour un incident (montants convertis en devise de référence). */
export function colonnesLdcL1(row: IncidentVueInput & { typeEvenement: string | null; dateReglement: Date | null }, cfg: IncidentsConfig): Record<string, string | number> {
  const parType = pertesParType(row.quasiIncident ? [] : sanitizePertes(row.pertes, cfg.deviseReference), cfg)
  const out: Record<string, string | number> = {
    typeEvenement: row.typeEvenement ?? '', quasiIncident: row.quasiIncident ? 'oui' : 'non',
    dateReglement: row.dateReglement ? row.dateReglement.toISOString().slice(0, 10) : '', devise: cfg.deviseReference,
  }
  for (const t of cfg.typesPerte.filter(x => x.actif)) out[`perte_${t.code}`] = parType[t.code] ?? ''
  return out
}
