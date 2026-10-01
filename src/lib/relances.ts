/**
 * relances.ts — Relances automatiques des éléments à traiter par le métier : questionnaires à
 * répondre, préconisations et plans d'action ouverts. Module PUR : décide si un élément doit être
 * relancé ; le cron `relances` regroupe par destinataire, envoie et marque `rappelLe` (anti-doublon).
 *  - ECHEANCE_PROCHE : une fois, quand l'échéance entre dans la fenêtre de `joursAvant` jours ;
 *  - EN_RETARD : au dépassement de l'échéance, puis tous les `periodiciteJours` ;
 *  - PERIODIQUE : tous les `periodiciteJours` (mensuel par défaut) tant que l'élément reste ouvert.
 * Paramétrage par organisation (`OrganizationConfig.relancesConfig`), ADMIN.
 */

export interface RelancesConfig {
  actives: boolean
  /** Relance « échéance proche » : nombre de jours avant l'échéance (1–90). */
  joursAvant: number
  /** Relance périodique et relance du retard : intervalle en jours (7–180), 0 = désactivée. */
  periodiciteJours: number
}

export const RELANCES_DEFAUT: RelancesConfig = { actives: true, joursAvant: 14, periodiciteJours: 30 }

export type TypeRelance = 'ECHEANCE_PROCHE' | 'EN_RETARD' | 'PERIODIQUE'
export interface ElementRelancable { echeance: Date | null; rappelLe: Date | null; createdAt: Date }

const J = 86_400_000
const borne = (v: unknown, min: number, max: number, def: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : def

/** Assainit une saisie (bornes ; 0 désactive la relance périodique ; le reste est ignoré). */
export function sanitizeRelancesConfig(input: unknown): RelancesConfig {
  const o = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {}
  const periode = o.periodiciteJours === 0 ? 0 : borne(o.periodiciteJours, 7, 180, RELANCES_DEFAUT.periodiciteJours)
  return {
    actives: typeof o.actives === 'boolean' ? o.actives : RELANCES_DEFAUT.actives,
    joursAvant: borne(o.joursAvant, 1, 90, RELANCES_DEFAUT.joursAvant),
    periodiciteJours: periode,
  }
}

/** Relance due pour un élément ouvert, ou null. */
export function typeRelance(e: ElementRelancable, cfg: RelancesConfig, now: Date): TypeRelance | null {
  if (!cfg.actives) return null
  const t = now.getTime()
  const dernier = e.rappelLe?.getTime() ?? null
  const periodeEcoulee = (depuis: number) => cfg.periodiciteJours > 0 && t - depuis >= cfg.periodiciteJours * J
  if (e.echeance) {
    const ech = e.echeance.getTime()
    if (ech < t) {
      // Pas encore relancé depuis le dépassement, ou période écoulée depuis la dernière relance.
      return dernier === null || dernier < ech || periodeEcoulee(dernier) ? 'EN_RETARD' : null
    }
    const debutFenetre = ech - cfg.joursAvant * J
    if (t >= debutFenetre) return dernier === null || dernier < debutFenetre ? 'ECHEANCE_PROCHE' : null
  }
  return periodeEcoulee(dernier ?? e.createdAt.getTime()) ? 'PERIODIQUE' : null
}
