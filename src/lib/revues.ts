// ─── Revues périodiques — PUR ─────────────────────────────────────────────────
// Systèmes d'IA, traitements RGPD, processus (BIA) et tiers : prochaine revue 12 mois après la dernière (règle déjà
// appliquée au registre IA, cf. registre-ia.revueEnRetard), ou après la création si l'objet n'a jamais été revu. Le cron
// `relances` relance avant l'échéance puis au dépassement (anti-doublon `revueRappelLe`). Testé : revues.test.ts.

export const MOIS_REVUE = 12

export function echeanceRevue(derniereRevue: Date | null, createdAt: Date): Date {
  const d = new Date(derniereRevue ?? createdAt)
  d.setUTCMonth(d.getUTCMonth() + MOIS_REVUE)
  return d
}

/**
 * Saisie « dernière revue » : date AAAA-MM-JJ passée ou du jour → Date ; vide → null (effacée) ; absente, invalide ou
 * future → undefined (champ ignoré, la valeur enregistrée est conservée).
 */
export function sanitizeDateRevue(v: unknown, now: Date): Date | null | undefined {
  if (v === null || v === '') return null
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined
  const d = new Date(`${v}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v || d.getTime() > now.getTime()) return undefined
  return d
}
