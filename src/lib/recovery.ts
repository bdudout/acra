/**
 * recovery.ts — Logique de rétention des analyses supprimées (corbeille).
 *
 * Suppression douce (soft delete) : une analyse supprimée par un utilisateur est
 * marquée `deletedAt` au lieu d'être effacée. Elle disparaît de ses vues mais reste
 * récupérable par un ADMIN pendant RECOVERY_RETENTION_DAYS jours via le module
 * « Récupération ». Au-delà, elle est purgée définitivement.
 *
 * Module pur (sans Prisma) → testé unitairement.
 */

export const RECOVERY_RETENTION_DAYS = 30

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Date seuil : toute analyse supprimée avant cette date est purgeable. */
export function purgeThreshold(now: Date = new Date()): Date {
  return new Date(now.getTime() - RECOVERY_RETENTION_DAYS * MS_PER_DAY)
}

/** Jours restants avant purge (0 si échue), arrondi au jour supérieur. */
export function daysRemaining(deletedAt: Date | string, now: Date = new Date()): number {
  const elapsed = (now.getTime() - new Date(deletedAt).getTime()) / MS_PER_DAY
  return Math.max(0, Math.ceil(RECOVERY_RETENTION_DAYS - elapsed))
}

/** Vrai si l'analyse supprimée a dépassé la fenêtre de rétention (purgeable). */
export function isExpired(deletedAt: Date | string, now: Date = new Date()): boolean {
  return new Date(deletedAt).getTime() <= purgeThreshold(now).getTime()
}
