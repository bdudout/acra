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

// Portée de la conformité de référence :
//  - ORGANISATION (défaut) : 1 suivi par référentiel, au niveau organisation ;
//  - ANALYSE : conformité portée par chaque analyse (Cadrage.socleSecurite) ;
//  - ENTITE : PLUSIEURS suivis nommés (par entité / socle) par référentiel,
//    réutilisables dans les analyses et visibles dans les dashboards.
// ORGANISATION et ENTITE vivent tous deux dans l'entité `Conformite` (org-level) ;
// ANALYSE vit dans l'analyse.
export const CONFORMITE_NIVEAUX = ['ORGANISATION', 'ANALYSE', 'ENTITE'] as const
/** Niveau de pilotage de la conformité : par organisation, par analyse ou par entité. */
export type ConformiteNiveau = typeof CONFORMITE_NIVEAUX[number]
export const DEFAULT_CONFORMITE_NIVEAU: ConformiteNiveau = 'ORGANISATION'

export const CONFORMITE_SNAPSHOT_MODES = ['MANUEL', 'AUTO', 'CHANGEMENT'] as const
/** Mode de figeage des versions de conformité : manuel, automatique ou sur changement. */
export type ConformiteSnapshotMode = typeof CONFORMITE_SNAPSHOT_MODES[number]
export const DEFAULT_CONFORMITE_SNAPSHOT_MODE: ConformiteSnapshotMode = 'MANUEL'

// Périodicité des snapshots AUTO (choisie par l'organisation).
export const CONFORMITE_SNAPSHOT_PERIODES = ['MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL'] as const
/** Périodicité des versions automatiques de conformité : mensuelle, trimestrielle, semestrielle ou annuelle. */
export type ConformiteSnapshotPeriode = typeof CONFORMITE_SNAPSHOT_PERIODES[number]
export const DEFAULT_CONFORMITE_SNAPSHOT_PERIODE: ConformiteSnapshotPeriode = 'MENSUEL'
const PERIODE_JOURS: Record<ConformiteSnapshotPeriode, number> = {
  MENSUEL: 30, TRIMESTRIEL: 91, SEMESTRIEL: 182, ANNUEL: 365,
}

/** Normalise une périodicité (valeur inconnue → défaut MENSUEL). */
export function sanitizeSnapshotPeriode(v: unknown): ConformiteSnapshotPeriode {
  return (CONFORMITE_SNAPSHOT_PERIODES as readonly string[]).includes(v as string)
    ? (v as ConformiteSnapshotPeriode)
    : DEFAULT_CONFORMITE_SNAPSHOT_PERIODE
}

/** Nombre de jours entre deux snapshots AUTO selon la périodicité configurée. */
export function snapshotPeriodeDays(v: unknown): number {
  return PERIODE_JOURS[sanitizeSnapshotPeriode(v)]
}

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

/** La conformité de référence est-elle portée au niveau organisation (suivi unique) ? */
export function isOrgLevelConformite(niveau: unknown): boolean {
  return sanitizeConformiteNiveau(niveau) === 'ORGANISATION'
}

/** Portée « par entité / socle » : plusieurs suivis nommés par référentiel. */
export function isEntiteLevelConformite(niveau: unknown): boolean {
  return sanitizeConformiteNiveau(niveau) === 'ENTITE'
}

// Override par analyse : une analyse peut forcer sa conformité en « propre »
// (ANALYSE) ou « reprendre le socle org » (ORGANISATION). Seules ces deux valeurs
// sont des overrides valides ; toute autre (null, '', ENTITE, invalide) → on suit
// la configuration de l'organisation.
export const ANALYSE_CONFORMITE_OVERRIDES = ['ANALYSE', 'ORGANISATION'] as const
/** Origine de la conformité d'une analyse : propre à l'analyse ou héritée de l'organisation. */
export type AnalyseConformiteOverride = typeof ANALYSE_CONFORMITE_OVERRIDES[number]

/** Portée EFFECTIVE de conformité d'une analyse : override d'analyse sinon config org. */
export function effectiveConformiteNiveau(analyseOverride: unknown, orgNiveau: string): string {
  return (ANALYSE_CONFORMITE_OVERRIDES as readonly string[]).includes(analyseOverride as string)
    ? (analyseOverride as string)
    : orgNiveau
}

/**
 * La conformité de référence vit-elle dans l'entité `Conformite` (org-level) ?
 * Vrai pour ORGANISATION et ENTITE ; faux pour ANALYSE (portée par l'analyse).
 */
export function usesConformiteEntity(niveau: unknown): boolean {
  const n = sanitizeConformiteNiveau(niveau)
  return n === 'ORGANISATION' || n === 'ENTITE'
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
