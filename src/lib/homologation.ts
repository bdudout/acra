// ─── Homologation de sécurité des systèmes d'information (PUR) ────────────────
// Décision formelle d'une autorité d'homologation, prise sur un dossier (analyse de risques, plan de traitement,
// risques résiduels acceptés, test d'intrusion, PCA/PRA, attestations des prestataires), pour une durée limitée.
// Cycle : PREPARATION → COMMISSION → HOMOLOGUE | HOMOLOGUE_RESERVES | REFUSE ; renvoi en préparation possible ;
// une homologation décidée peut être rouverte (réexamen). Séparation : celui qui prépare ne décide jamais.
// Spec : docs/specs/protection-sociale-specs.md (P2). Module pur → testé (homologation.test.ts).

import type { UserRole } from '@/lib/permissions'

export const HOMOLOGATION_STATUTS = ['PREPARATION', 'COMMISSION', 'HOMOLOGUE', 'HOMOLOGUE_RESERVES', 'REFUSE'] as const
export type HomologationStatut = (typeof HOMOLOGATION_STATUTS)[number]
export const PIECES_HOMOLOGATION = ['ANALYSE_RISQUES', 'PLAN_TRAITEMENT', 'RISQUES_RESIDUELS', 'TEST_INTRUSION', 'PCA_PRA', 'ATTESTATIONS_PRESTATAIRES'] as const
export type PieceHomologation = (typeof PIECES_HOMOLOGATION)[number]
export interface PieceEtat { type: PieceHomologation; fourni: boolean; reference?: string }
export interface Reserve { texte: string; echeance?: string }
export type EtatValidite = 'NON_DECIDEE' | 'VALIDE' | 'A_RENOUVELER' | 'EXPIREE' | 'REFUSEE'

export const DUREE_DEFAUT_MOIS = 36
export const DUREE_MAX_MOIS = 60
/** En deçà de ce délai avant la fin de validité, l'homologation est « à renouveler ». */
export const PREAVIS_RENOUVELLEMENT_MOIS = 6
const DECISIONS: readonly HomologationStatut[] = ['HOMOLOGUE', 'HOMOLOGUE_RESERVES', 'REFUSE']

export const isHomologationStatut = (v: unknown): v is HomologationStatut => typeof v === 'string' && (HOMOLOGATION_STATUTS as readonly string[]).includes(v)
export const isDecision = (s: HomologationStatut) => DECISIONS.includes(s)

/** Dossier vierge : toutes les pièces attendues, à fournir. */
export function piecesInitiales(): PieceEtat[] {
  return PIECES_HOMOLOGATION.map(type => ({ type, fourni: false }))
}

/** Pièces reçues assainies : une entrée par type connu (la première reçue fait foi), référence bornée. */
export function sanitizePieces(input: unknown): PieceEtat[] {
  const list = Array.isArray(input) ? input : []
  return PIECES_HOMOLOGATION.map(type => {
    const raw = list.find((p): p is Record<string, unknown> => !!p && typeof p === 'object' && (p as { type?: unknown }).type === type)
    const reference = typeof raw?.reference === 'string' && raw.reference.trim() ? raw.reference.trim().slice(0, 200) : undefined
    return { type, fourni: raw?.fourni === true, ...(reference ? { reference } : {}) }
  })
}

export const dossierComplet = (pieces: readonly PieceEtat[]) => PIECES_HOMOLOGATION.every(t => pieces.some(p => p.type === t && p.fourni))

/** Réserves assainies : texte obligatoire (≤ 500), échéance AAAA-MM-JJ valide facultative, 20 au plus. */
export function sanitizeReserves(input: unknown): Reserve[] {
  if (!Array.isArray(input)) return []
  const out: Reserve[] = []
  for (const r of input) {
    if (!r || typeof r !== 'object') continue
    const texte = typeof (r as { texte?: unknown }).texte === 'string' ? (r as { texte: string }).texte.trim().slice(0, 500) : ''
    if (!texte) continue
    const e = (r as { echeance?: unknown }).echeance
    const echeance = typeof e === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e) && !Number.isNaN(Date.parse(e)) ? e : undefined
    out.push({ texte, ...(echeance ? { echeance } : {}) })
    if (out.length >= 20) break
  }
  return out
}

/** Durée de validité en mois, bornée [1, 60] ; défaut 36. */
export function sanitizeDuree(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  if (!Number.isFinite(n)) return DUREE_DEFAUT_MOIS
  return Math.min(DUREE_MAX_MOIS, Math.max(1, Math.round(n)))
}

export function calcDateFin(dateDecision: Date, dureeMois: number): Date {
  const d = new Date(dateDecision.getTime())
  d.setUTCMonth(d.getUTCMonth() + dureeMois)
  return d
}

export function etatValidite(h: { statut: string; dateFin: Date | string | null | undefined }, now: Date): EtatValidite {
  if (h.statut === 'REFUSE') return 'REFUSEE'
  if (h.statut !== 'HOMOLOGUE' && h.statut !== 'HOMOLOGUE_RESERVES') return 'NON_DECIDEE'
  const fin = h.dateFin ? new Date(h.dateFin) : null
  if (!fin || fin.getTime() <= now.getTime()) return 'EXPIREE'
  const seuil = new Date(now.getTime()); seuil.setUTCMonth(seuil.getUTCMonth() + PREAVIS_RENOUVELLEMENT_MOIS)
  return fin.getTime() <= seuil.getTime() ? 'A_RENOUVELER' : 'VALIDE'
}

const PREPARATEURS: readonly UserRole[] = ['RSSI', 'RISK_MANAGER', 'ADMIN', 'SUPER_ADMIN']
const DECIDEURS: readonly UserRole[] = ['DIRECTION_METIER', 'ADMIN', 'SUPER_ADMIN']

export const canPreparerHomologation = (role: UserRole) => PREPARATEURS.includes(role)

/** Autorité désignée, ou direction métier / administrateur de l'organisation — jamais le préparateur. */
export function canDeciderHomologation(user: { id: string; role: UserRole }, h: { preparePar: string; autoriteId?: string | null }): boolean {
  if (user.id === h.preparePar) return false
  return (h.autoriteId != null && user.id === h.autoriteId) || DECIDEURS.includes(user.role)
}

export type TransitionResult = { ok: true } | { ok: false; code: 'transition_interdite' | 'role_interdit' | 'separation' | 'dossier_incomplet' | 'reserves_requises' }

/** Transition demandée par `user` : graphe d'états, droits, séparation, complétude du dossier, réserves. */
export function validerTransition(
  h: { statut: HomologationStatut; preparePar: string; autoriteId?: string | null; pieces: readonly PieceEtat[] },
  to: HomologationStatut,
  user: { id: string; role: UserRole },
  reserves: readonly Reserve[] = [],
): TransitionResult {
  const from = h.statut
  const allowed: Record<HomologationStatut, HomologationStatut[]> = {
    PREPARATION: ['COMMISSION'],
    COMMISSION: ['HOMOLOGUE', 'HOMOLOGUE_RESERVES', 'REFUSE', 'PREPARATION'],
    HOMOLOGUE: ['PREPARATION'],
    HOMOLOGUE_RESERVES: ['PREPARATION'],
    REFUSE: ['PREPARATION'],
  }
  if (!allowed[from].includes(to)) return { ok: false, code: 'transition_interdite' }
  if (isDecision(to)) {
    if (user.id === h.preparePar) return { ok: false, code: 'separation' }
    if (!canDeciderHomologation(user, h)) return { ok: false, code: 'role_interdit' }
    if (to !== 'REFUSE' && !dossierComplet(h.pieces)) return { ok: false, code: 'dossier_incomplet' }
    if (to === 'HOMOLOGUE_RESERVES' && reserves.length === 0) return { ok: false, code: 'reserves_requises' }
    return { ok: true }
  }
  // Renvoi en préparation depuis la commission : l'autorité ou un préparateur ; réexamen d'une décision : un préparateur.
  if (to === 'PREPARATION' && from === 'COMMISSION') {
    return canPreparerHomologation(user.role) || canDeciderHomologation(user, h) ? { ok: true } : { ok: false, code: 'role_interdit' }
  }
  return canPreparerHomologation(user.role) ? { ok: true } : { ok: false, code: 'role_interdit' }
}

/**
 * Relance de renouvellement : une alerte à l'entrée en « à renouveler » (aucun rappel encore), une seconde à
 * l'expiration (dernier rappel antérieur à la fin de validité). Le marqueur `rappelLe` est remis à zéro à
 * chaque nouvelle décision ou réexamen.
 */
export function relanceHomologation(h: { statut: string; dateFin: Date | null; rappelLe: Date | null }, now: Date): 'ECHEANCE_PROCHE' | 'EN_RETARD' | null {
  const etat = etatValidite(h, now)
  if (etat === 'A_RENOUVELER') return h.rappelLe ? null : 'ECHEANCE_PROCHE'
  if (etat === 'EXPIREE' && h.dateFin) return !h.rappelLe || h.rappelLe.getTime() < h.dateFin.getTime() ? 'EN_RETARD' : null
  return null
}
