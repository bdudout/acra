// ─── Archivage des missions de contrôle/audit ────────────────────────────────
// Une mission (campagne de contrôle N1/N2, mission d'audit interne) devient
// ARCHIVABLE quand elle est close, que ses constats/plans d'action associés sont
// clos, et qu'elle dépasse la durée de conservation configurée (défaut 5 ans).
// L'archivage la masque par défaut tout en la conservant pour la piste d'audit.
// Logique PURE : décision d'archivage + bornage de la durée. Testée.

export const ARCHIVAGE_DUREE_DEFAUT_ANNEES = 5
const ARCHIVAGE_DUREE_MIN = 1
const ARCHIVAGE_DUREE_MAX = 30

/** Borne la durée de conservation (années entières 1..30), défaut si invalide. */
export function cleanArchivageDuree(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < ARCHIVAGE_DUREE_MIN) return ARCHIVAGE_DUREE_DEFAUT_ANNEES
  return Math.min(ARCHIVAGE_DUREE_MAX, Math.round(n))
}

export interface ArchivableInput {
  statut: string
  dateFin?: Date | string | null
  archiveLe?: Date | string | null
  /** Nombre de constats/plans d'action encore ouverts (audit). 0/absent = tous clos. */
  constatsOuverts?: number
}

function toDate(v: unknown): Date | null {
  if (v == null || v === '') return null
  const d = v instanceof Date ? v : new Date(v as string)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Vrai si la mission peut être archivée : close, non déjà archivée, sans constat
 * ouvert, et close depuis au moins `dureeAnnees` (âge calculé sur la date de fin).
 */
export function estArchivable(m: ArchivableInput, now: Date, dureeAnnees: number): boolean {
  if (toDate(m.archiveLe)) return false // déjà archivée
  if (m.statut !== 'CLOTUREE') return false
  if ((m.constatsOuverts ?? 0) > 0) return false
  const fin = toDate(m.dateFin)
  if (!fin) return false // âge indéterminé
  const ageAnnees = (now.getTime() - fin.getTime()) / (365.25 * 86_400_000)
  return ageAnnees >= dureeAnnees
}
