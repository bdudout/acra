/**
 * relances.ts — Relances automatiques des éléments à traiter par le métier : questionnaires à
 * répondre, préconisations et plans d'action ouverts. Module PUR : décide si un élément doit être
 * relancé ; le cron `relances` regroupe par destinataire, envoie et marque `rappelLe` (anti-doublon).
 *  - ECHEANCE_PROCHE : une fois, quand l'échéance entre dans la fenêtre de `joursAvant` jours ;
 *  - EN_RETARD : au dépassement de l'échéance, puis tous les `periodiciteJours` ;
 *  - PERIODIQUE : tous les `periodiciteJours` (mensuel par défaut) tant que l'élément reste ouvert.
 * Validations et vérifications en attente (préconisation réalisée à vérifier, analyse soumise,
 * dérogation en revue) : première relance après `attenteJours` d'attente, puis tous les `periodiciteJours`.
 * Paramétrage par organisation (`OrganizationConfig.relancesConfig`), ADMIN.
 */

export interface RelancesConfig {
  actives: boolean
  /** Relance « échéance proche » : nombre de jours avant l'échéance (1–90). */
  joursAvant: number
  /** Relance périodique et relance du retard : intervalle en jours (7–180), 0 = désactivée. */
  periodiciteJours: number
  /** Validation / vérification en attente : première relance après ce nombre de jours (1–60). */
  attenteJours: number
}

export const RELANCES_DEFAUT: RelancesConfig = { actives: true, joursAvant: 14, periodiciteJours: 30, attenteJours: 7 }

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
    attenteJours: borne(o.attenteJours, 1, 60, RELANCES_DEFAUT.attenteJours),
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

/**
 * Relance due pour une décision en attente depuis `depuis` (entrée dans l'état d'attente).
 * Une relance antérieure à `depuis` appartient à un cycle précédent (ex. re-soumission) : ignorée.
 */
export function relanceAttenteDue(e: { depuis: Date; rappelLe: Date | null }, cfg: RelancesConfig, now: Date): boolean {
  if (!cfg.actives) return false
  const t = now.getTime()
  const dernier = e.rappelLe && e.rappelLe.getTime() >= e.depuis.getTime() ? e.rappelLe.getTime() : null
  if (dernier === null) return t - e.depuis.getTime() >= cfg.attenteJours * J
  return cfg.periodiciteJours > 0 && t - dernier >= cfg.periodiciteJours * J
}


// ─── Destinataires des décisions en attente (purs) ───────────────────────────

export interface MembreDecideur { role: string; userId: string }
const ADMINS = ['ADMIN', 'SUPER_ADMIN']
const unique = (ids: string[]) => [...new Set(ids)]
const ayant = (membres: MembreDecideur[], roles: readonly string[], exclus: (string | null | undefined)[]) =>
  unique(membres.filter(m => roles.includes(m.role) && !exclus.includes(m.userId)).map(m => m.userId))

/**
 * Approbateurs d'une analyse soumise (même règle que `canApproveAnalyse`) : RISK_MANAGER et RSSI,
 * jamais l'auteur, et pas ceux qu'un accès granulaire restreint sans droit d'APPROBATION. Projet 360 :
 * seuls les rôles dont l'avis manque encore (double approbation). À défaut : les administrateurs.
 */
export function approbateursAnalyse(
  membres: MembreDecideur[],
  a: { auteurId: string; projet360: boolean; rolesDejaApprouves: string[]; acces: { userId: string; permission: string }[] },
): string[] {
  const roles = a.projet360 ? ['RSSI', 'RISK_MANAGER'].filter(r => !a.rolesDejaApprouves.includes(r)) : ['RSSI', 'RISK_MANAGER']
  const restreints = a.acces.filter(x => x.permission !== 'APPROBATION').map(x => x.userId)
  const ids = ayant(membres, roles, [a.auteurId, ...restreints])
  return ids.length ? ids : ayant(membres, ADMINS, [a.auteurId, ...restreints])
}

/**
 * Valideurs attendus d'une dérogation en revue (mêmes gardes que lib/derogation) : RSSI pour l'avis
 * (≠ demandeur) et le double regard (≠ demandeur et ≠ premier avis), direction métier pour la
 * validation (≠ demandeur ; administrateurs à défaut). Autre statut : personne.
 */
export function valideursDerogation(membres: MembreDecideur[], d: { statut: string; demandeurId: string; avisRssiPar: string | null }): string[] {
  if (d.statut === 'DEMANDEE') return ayant(membres, ['RSSI'], [d.demandeurId])
  if (d.statut === 'DOUBLE_REGARD') return ayant(membres, ['RSSI'], [d.demandeurId, d.avisRssiPar])
  if (d.statut === 'VALIDATION_METIER') {
    const metier = ayant(membres, ['DIRECTION_METIER'], [d.demandeurId])
    return metier.length ? metier : ayant(membres, ADMINS, [d.demandeurId])
  }
  return []
}

/** Début de l'attente d'une dérogation en revue (création, dernière demande de prolongation, avis précédent). */
export function attenteDerogationDepuis(d: { statut: string; createdAt: Date; avisRssiLe: Date | null; doubleRegardLe: Date | null; prolongationDemandee: Date | null; prolongations: unknown }): Date {
  if (d.statut === 'DOUBLE_REGARD') return d.avisRssiLe ?? d.createdAt
  if (d.statut === 'VALIDATION_METIER') return d.doubleRegardLe ?? d.avisRssiLe ?? d.createdAt
  if (d.prolongationDemandee && Array.isArray(d.prolongations) && d.prolongations.length) {
    const le = (d.prolongations[d.prolongations.length - 1] as { le?: unknown })?.le
    const t = typeof le === 'string' || le instanceof Date ? new Date(le) : null
    if (t && !Number.isNaN(t.getTime())) return t
  }
  return d.createdAt
}
