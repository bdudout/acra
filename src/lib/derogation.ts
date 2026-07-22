/**
 * derogation.ts — Logique PURE des dérogations (acceptation temporaire d'une
 * non-conformité au socle). Voir docs/derogations-spec.md.
 *
 * Aucune dépendance React/DB/i18n : machine à états du workflow, calcul de l'état
 * effectif (expiration), déclenchement des alertes, validation d'entrée et
 * garde-fous RBAC. Testé dans src/__tests__/unit/lib/derogation.test.ts.
 */
import { isAdminRole, type SessionUser } from '@/lib/permissions'

export type DerogationPortee = 'CONTROLE' | 'RISQUE' | 'SOCLE'
export const DEROGATION_PORTEES: DerogationPortee[] = ['CONTROLE', 'RISQUE', 'SOCLE']

/** Statuts persistés (colonne `statut`). Les états d'expiration sont CALCULÉS, pas stockés. */
export type DerogationStatut =
  | 'DEMANDEE'          // en attente d'avis RSSI
  | 'DOUBLE_REGARD'     // RSSI a demandé un second avis (RSSI groupe)
  | 'VALIDATION_METIER' // avis RSSI favorable, en attente de validation métier
  | 'ACTIVE'            // validée par le métier, en cours
  | 'REJETEE'           // refusée pendant la revue
  | 'CLOTUREE'          // clôturée (non-conformité résolue, preuves fournies)
  | 'REVOQUEE'          // révoquée alors qu'elle était active
export const DEROGATION_STATUTS: DerogationStatut[] =
  ['DEMANDEE', 'DOUBLE_REGARD', 'VALIDATION_METIER', 'ACTIVE', 'REJETEE', 'CLOTUREE', 'REVOQUEE']

/** État effectif pour l'affichage : les statuts + les états d'expiration dérivés d'ACTIVE. */
export type DerogationEtat = DerogationStatut | 'EXPIRE_BIENTOT' | 'EXPIREE'

const JOUR_MS = 86_400_000

// ─── Dates & expiration ──────────────────────────────────────────────────────

/** Date de fin par défaut = début + durée (jours). */
export function calcDateFin(dateDebut: Date, dureeJours: number): Date {
  return new Date(dateDebut.getTime() + dureeJours * JOUR_MS)
}

/** Jours (entiers) restants avant `dateFin` ; négatif si déjà dépassée. */
export function joursAvantExpiration(dateFin: Date | string | null | undefined, now: Date = new Date()): number {
  if (!dateFin) return Infinity
  const fin = typeof dateFin === 'string' ? new Date(dateFin) : dateFin
  return Math.ceil((fin.getTime() - now.getTime()) / JOUR_MS)
}

export interface DerogationEtatSource {
  statut: DerogationStatut
  dateFin?: Date | string | null
}

/**
 * État effectif : pour une dérogation ACTIVE, dérive `EXPIREE` (dépassée) ou
 * `EXPIRE_BIENTOT` (dans la fenêtre d'alerte) ; sinon renvoie le statut brut.
 */
export function etatDerogation(d: DerogationEtatSource, alerteJours: number, now: Date = new Date()): DerogationEtat {
  if (d.statut !== 'ACTIVE') return d.statut
  const j = joursAvantExpiration(d.dateFin ?? null, now)
  if (j === Infinity) return 'ACTIVE'
  if (j < 0) return 'EXPIREE'
  if (j <= alerteJours) return 'EXPIRE_BIENTOT'
  return 'ACTIVE'
}

export interface DerogationAlerteSource extends DerogationEtatSource {
  alerteeLe?: Date | string | null
}

/**
 * Vrai si une alerte individuelle d'expiration doit partir : dérogation ACTIVE,
 * jamais encore alertée, et dans la fenêtre d'alerte (ou déjà expirée).
 */
export function needsExpiryAlert(d: DerogationAlerteSource, alerteJours: number, now: Date = new Date()): boolean {
  if (d.statut !== 'ACTIVE' || d.alerteeLe) return false
  return joursAvantExpiration(d.dateFin ?? null, now) <= alerteJours
}

// ─── Validation d'entrée ─────────────────────────────────────────────────────

export interface DerogationInput {
  portee: string
  referentiel?: string | null
  ref?: string | null
  risqueId?: string | null
  intitule?: string | null
  motif?: string | null
  mesuresCompensatoires?: string | null
}

export type DerogationInputError =
  | 'intitule_requis' | 'motif_requis' | 'mesures_requises'
  | 'portee_invalide' | 'controle_incomplet' | 'risque_manquant' | 'socle_incomplet'

/** Valide une demande de dérogation AVANT écriture. Renvoie une clé d'erreur ou null. */
export function validateDerogationInput(input: DerogationInput): DerogationInputError | null {
  if (!input.intitule?.trim()) return 'intitule_requis'
  if (!input.motif?.trim()) return 'motif_requis'
  if (!input.mesuresCompensatoires?.trim()) return 'mesures_requises'
  if (!DEROGATION_PORTEES.includes(input.portee as DerogationPortee)) return 'portee_invalide'
  if (input.portee === 'CONTROLE' && !(input.referentiel?.trim() && input.ref?.trim())) return 'controle_incomplet'
  if (input.portee === 'RISQUE' && !input.risqueId?.trim()) return 'risque_manquant'
  if (input.portee === 'SOCLE' && !input.referentiel?.trim()) return 'socle_incomplet'
  return null
}

// ─── Machine à états (transitions PURES) ─────────────────────────────────────

/** Statut résultant de l'avis RSSI (défavorable → rejet ; double regard → 2e RSSI ; sinon → métier). */
export function statutApresAvisRssi(favorable: boolean, demandeDoubleRegard: boolean): DerogationStatut {
  if (!favorable) return 'REJETEE'
  return demandeDoubleRegard ? 'DOUBLE_REGARD' : 'VALIDATION_METIER'
}

/** Statut résultant du double regard (2e RSSI). */
export function statutApresDoubleRegard(favorable: boolean): DerogationStatut {
  return favorable ? 'VALIDATION_METIER' : 'REJETEE'
}

/** Statuts terminaux (plus aucune transition possible). */
export function estTerminale(statut: DerogationStatut): boolean {
  return statut === 'REJETEE' || statut === 'CLOTUREE' || statut === 'REVOQUEE'
}

/** Entrée d'historique de prolongation (pure). */
export function prolongationEntry(ancienneDateFin: Date | null, nouvelleDateFin: Date, motif: string, parUserId: string, now: Date = new Date()) {
  return {
    ancienneDateFin: ancienneDateFin ? ancienneDateFin.toISOString() : null,
    nouvelleDateFin: nouvelleDateFin.toISOString(),
    motif: motif.trim(),
    par: parUserId,
    le: now.toISOString(),
  }
}

// ─── Garde-fous RBAC (qui peut faire quoi, selon le rôle + l'état) ───────────

export interface DerogationRbacSource {
  statut: DerogationStatut
  demandeurId: string
  avisRssiPar?: string | null
}

/** Avis RSSI : un RSSI, différent du demandeur (quatre-yeux), depuis DEMANDEE. */
export function canAvisRssiDerogation(user: SessionUser, d: DerogationRbacSource): boolean {
  return d.statut === 'DEMANDEE' && user.role === 'RSSI' && user.id !== d.demandeurId
}

/** Double regard : un RSSI DIFFÉRENT du premier (et du demandeur), depuis DOUBLE_REGARD. */
export function canDoubleRegardDerogation(user: SessionUser, d: DerogationRbacSource): boolean {
  return d.statut === 'DOUBLE_REGARD' && user.role === 'RSSI'
    && user.id !== d.avisRssiPar && user.id !== d.demandeurId
}

/** Validation métier : DIRECTION_METIER (ou admin en secours), depuis VALIDATION_METIER. */
export function canValiderDerogation(user: SessionUser, d: DerogationRbacSource): boolean {
  return d.statut === 'VALIDATION_METIER' && (user.role === 'DIRECTION_METIER' || isAdminRole(user.role))
}

/** Révocation d'une dérogation ACTIVE : RSSI, métier ou admin. */
export function canRevoquerDerogation(user: SessionUser, d: DerogationRbacSource): boolean {
  return d.statut === 'ACTIVE'
    && (user.role === 'RSSI' || user.role === 'DIRECTION_METIER' || isAdminRole(user.role))
}

/**
 * Clôture d'une dérogation ACTIVE (non-conformité résolue, avec preuves) : le
 * porteur (éditeur de l'analyse), le RSSI ou un admin. `peutEditer` = résultat de
 * canEditAnalyse côté appelant (le porteur n'a pas de rôle dédié).
 */
export function canCloturerDerogation(user: SessionUser, d: DerogationRbacSource, peutEditer: boolean): boolean {
  return d.statut === 'ACTIVE' && (peutEditer || user.role === 'RSSI' || isAdminRole(user.role))
}
