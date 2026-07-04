/**
 * conformite-config.ts — Options de configuration de la conformité (Palier 2).
 *
 * Deux réglages par organisation (OrganizationConfig) :
 *  - niveau      : où vit la conformité de référence — par ANALYSE (défaut,
 *                  rétrocompatible : Cadrage.socleSecurite) ou par ORGANISATION
 *                  (entité Conformite, clé organisation × référentiel) ;
 *  - snapshotMode: comment les versions/snapshots sont créés — MANUEL (l'utilisateur
 *                  fige une version), AUTO (périodique) ou CHANGEMENT (à chaque modif).
 *
 * Module PUR (pas de DB) → testé unitairement.
 */

export const CONFORMITE_NIVEAUX = ['ANALYSE', 'ORGANISATION'] as const
export type ConformiteNiveau = typeof CONFORMITE_NIVEAUX[number]
export const DEFAULT_CONFORMITE_NIVEAU: ConformiteNiveau = 'ANALYSE'

export const CONFORMITE_SNAPSHOT_MODES = ['MANUEL', 'AUTO', 'CHANGEMENT'] as const
export type ConformiteSnapshotMode = typeof CONFORMITE_SNAPSHOT_MODES[number]
export const DEFAULT_CONFORMITE_SNAPSHOT_MODE: ConformiteSnapshotMode = 'MANUEL'

/** Normalise une valeur de niveau (valeur inconnue → défaut ANALYSE). */
export function sanitizeConformiteNiveau(v: unknown): ConformiteNiveau {
  return (CONFORMITE_NIVEAUX as readonly string[]).includes(v as string)
    ? (v as ConformiteNiveau)
    : DEFAULT_CONFORMITE_NIVEAU
}

/** Normalise un mode de snapshot (valeur inconnue → défaut MANUEL). */
export function sanitizeSnapshotMode(v: unknown): ConformiteSnapshotMode {
  return (CONFORMITE_SNAPSHOT_MODES as readonly string[]).includes(v as string)
    ? (v as ConformiteSnapshotMode)
    : DEFAULT_CONFORMITE_SNAPSHOT_MODE
}

/** La conformité de référence est-elle portée au niveau organisation ? */
export function isOrgLevelConformite(niveau: unknown): boolean {
  return sanitizeConformiteNiveau(niveau) === 'ORGANISATION'
}

/**
 * Faut-il créer un snapshot À CHAQUE modification ? Vrai seulement en mode
 * CHANGEMENT. (MANUEL = à la demande ; AUTO = périodique, hors édition inline.)
 */
export function shouldSnapshotOnChange(mode: unknown): boolean {
  return sanitizeSnapshotMode(mode) === 'CHANGEMENT'
}

/** Période (jours) entre deux snapshots automatiques (mode AUTO). */
export const AUTO_SNAPSHOT_PERIOD_DAYS = 30

/**
 * En mode AUTO, un nouveau snapshot est-il dû ? Vrai s'il n'y en a jamais eu, ou
 * si le dernier date de plus de `periodDays`. Pur (temps injecté) → testé.
 */
export function dueForAutoSnapshot(lastAt: Date | null | undefined, now: Date, periodDays: number = AUTO_SNAPSHOT_PERIOD_DAYS): boolean {
  if (!lastAt) return true
  const elapsedMs = now.getTime() - new Date(lastAt).getTime()
  return elapsedMs >= periodDays * 24 * 60 * 60 * 1000
}
