// ─── Rétention du journal d'audit : bornes et date limite (logique pure, testée : audit-retention.test.ts) ───────────
// Durée en mois, réglée par le super-administrateur (Administration › Journalisation). null = conservation illimitée.
// Borne basse 12 mois : en deçà, la traçabilité attendue d'un établissement régulé (enquête d'incident, contrôle) serait
// compromise ; borne haute 240 mois.
export const RETENTION_MIN_MOIS = 12
export const RETENTION_MAX_MOIS = 240

export function lireRetention(raw: unknown): { ok: true; value: number | null } | { ok: false; error: 'retention_hors_bornes' } {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null }
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < RETENTION_MIN_MOIS || raw > RETENTION_MAX_MOIS) return { ok: false, error: 'retention_hors_bornes' }
  return { ok: true, value: raw }
}

/** Date limite : entrées strictement antérieures purgeables (mois soustraits en UTC ; le débordement de fin de mois suit Date). */
export function dateLimiteRetention(now: Date, mois: number): Date {
  const d = new Date(now.getTime())
  d.setUTCMonth(d.getUTCMonth() - mois)
  return d
}
