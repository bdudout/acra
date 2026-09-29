/**
 * audit-config.ts — Paramétrage de l'audit interne par organisation (lot L4, suite). Module PUR.
 * Défauts → surcharges de l'ADMIN (`OrganizationConfig.auditConfig`) : rappels automatiques
 * des recommandations et cycles de couverture par cotation de risque (1–4) en années.
 */

export interface AuditConfig {
  rappelsActifs: boolean
  /** Rappel « échéance proche » : nombre de jours avant l'échéance (1–90). */
  rappelJoursAvant: number
  /** Période minimale entre deux rappels sur un même constat (1–90 jours). */
  rappelRelanceJours: number
  /** Surcharge du cycle de couverture (années, 1–10) par cotation de risque 1–4. */
  cycles: Record<number, number>
}

export const AUDIT_CONFIG_DEFAUT: AuditConfig = { rappelsActifs: true, rappelJoursAvant: 14, rappelRelanceJours: 7, cycles: {} }

const borne = (v: unknown, min: number, max: number, def: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : def

/** Assainit une saisie (bornes, cotations 1–4, cycles 1–10 ans ; le reste est ignoré). */
export function sanitizeAuditConfig(input: unknown): AuditConfig {
  const o = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {}
  const cycles: Record<number, number> = {}
  const raw = o.cycles && typeof o.cycles === 'object' ? (o.cycles as Record<string, unknown>) : {}
  for (const [k, v] of Object.entries(raw)) {
    const cot = Number(k)
    if (Number.isInteger(cot) && cot >= 1 && cot <= 4 && typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 10) cycles[cot] = v
  }
  return {
    rappelsActifs: typeof o.rappelsActifs === 'boolean' ? o.rappelsActifs : AUDIT_CONFIG_DEFAUT.rappelsActifs,
    rappelJoursAvant: borne(o.rappelJoursAvant, 1, 90, AUDIT_CONFIG_DEFAUT.rappelJoursAvant),
    rappelRelanceJours: borne(o.rappelRelanceJours, 1, 90, AUDIT_CONFIG_DEFAUT.rappelRelanceJours),
    cycles,
  }
}

/** Configuration effective (colonne JSON brute → valeurs sûres). */
export function resolveAuditConfig(raw: unknown): AuditConfig { return sanitizeAuditConfig(raw) }
