// ─── Socle GRC — M2 : plan d'action / traitement rattaché à un RiskItem ──────
// Une action de traitement (mesure) portée par un risque du registre canonique.
// Logique PURE : validation, normalisation, statut effectif (retard dérivé de
// l'échéance) et synthèse d'avancement. L'UI/API ne fait que consommer.

export const RISK_ACTION_STATUTS = ['A_FAIRE', 'EN_COURS', 'FAIT'] as const
export type RiskActionStatut = (typeof RISK_ACTION_STATUTS)[number]
// Le retard n'est PAS stocké : il se dérive de l'échéance vs. aujourd'hui.
export type EffectiveStatut = RiskActionStatut | 'EN_RETARD'

// Priorité d'une action de traitement (pilote l'échéance par défaut).
export const ACTION_PRIORITES = ['CRITIQUE', 'MAJEUR', 'MODERE'] as const
export type ActionPriorite = (typeof ACTION_PRIORITES)[number]

export interface ActionDelaisMois { CRITIQUE: number; MAJEUR: number; MODERE: number }
/** Délais par défaut (mois) : critique = 6 mois, majeur = 1 an, modéré = 2 ans. */
export const DEFAULT_ACTION_DELAIS_MOIS: ActionDelaisMois = { CRITIQUE: 6, MAJEUR: 12, MODERE: 24 }

export function cleanPriorite(v: unknown): ActionPriorite {
  return ACTION_PRIORITES.includes(v as ActionPriorite) ? (v as ActionPriorite) : 'MAJEUR'
}

/** Nettoie/valide la table de délais (mois entiers 1..600), défauts par clé. */
export function cleanActionDelais(input: unknown): ActionDelaisMois {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const one = (k: keyof ActionDelaisMois): number => {
    const n = Number(src[k])
    return Number.isInteger(n) && n >= 1 && n <= 600 ? n : DEFAULT_ACTION_DELAIS_MOIS[k]
  }
  return { CRITIQUE: one('CRITIQUE'), MAJEUR: one('MAJEUR'), MODERE: one('MODERE') }
}

/** Ajoute `n` mois à une date en bornant le jour (31 janv + 1 mois → 28/29 févr). */
function addMonths(from: Date, n: number): Date {
  const d = new Date(from.getTime())
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return d
}

/**
 * Échéance par défaut ('YYYY-MM-DD') pour une priorité, selon les délais
 * configurés et une date de départ (aujourd'hui par défaut).
 */
export function defaultEcheanceForPriorite(priorite: unknown, delais: ActionDelaisMois, from: Date = new Date()): string {
  const p = cleanPriorite(priorite)
  const d = addMonths(from, delais[p])
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export interface RiskActionInput {
  intitule?: unknown
  description?: unknown
  responsable?: unknown
  echeance?: unknown // 'YYYY-MM-DD' | ISO | null
  statut?: unknown
  priorite?: unknown
}

export interface CleanRiskAction {
  intitule: string
  description: string | null
  responsable: string | null
  echeance: Date | null
  statut: RiskActionStatut
  priorite: ActionPriorite
}

function parseDate(v: unknown): Date | null {
  if (v == null || v === '') return null
  const d = new Date(v as string)
  return Number.isNaN(d.getTime()) ? null : d
}

// Renvoie un code d'erreur i18n, ou null si l'entrée est valide.
export function validateRiskActionInput(body: RiskActionInput): string | null {
  if (typeof body.intitule !== 'string' || body.intitule.trim() === '') return 'intitule_requis'
  if (body.echeance != null && body.echeance !== '' && parseDate(body.echeance) == null) return 'echeance_invalide'
  if (body.statut != null && !RISK_ACTION_STATUTS.includes(body.statut as RiskActionStatut)) return 'statut_invalide'
  return null
}

export function cleanRiskActionInput(body: RiskActionInput): CleanRiskAction {
  const s = body.statut as RiskActionStatut
  return {
    intitule: String(body.intitule).trim(),
    description: typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null,
    responsable: typeof body.responsable === 'string' && body.responsable.trim() ? body.responsable.trim() : null,
    echeance: parseDate(body.echeance),
    statut: RISK_ACTION_STATUTS.includes(s) ? s : 'A_FAIRE',
    priorite: cleanPriorite(body.priorite),
  }
}

export interface ActionLike {
  statut: string
  echeance: Date | string | null
}

// Statut effectif : EN_RETARD si l'échéance est dépassée et l'action non FAITe.
export function effectiveStatut(action: ActionLike, now: Date): EffectiveStatut {
  const statut = (RISK_ACTION_STATUTS as readonly string[]).includes(action.statut)
    ? (action.statut as RiskActionStatut) : 'A_FAIRE'
  if (statut === 'FAIT') return 'FAIT'
  const ech = action.echeance == null ? null : new Date(action.echeance)
  if (ech && !Number.isNaN(ech.getTime()) && ech.getTime() < now.getTime()) return 'EN_RETARD'
  return statut
}

export interface ActionsSummary {
  total: number
  faits: number
  enCours: number
  aFaire: number
  enRetard: number
  tauxAvancement: number // pourcentage entier de FAIT sur le total (0 si aucune action)
}

export function summarizeActions(actions: ActionLike[], now: Date): ActionsSummary {
  const s: ActionsSummary = { total: actions.length, faits: 0, enCours: 0, aFaire: 0, enRetard: 0, tauxAvancement: 0 }
  for (const a of actions) {
    switch (effectiveStatut(a, now)) {
      case 'FAIT': s.faits++; break
      case 'EN_RETARD': s.enRetard++; break
      case 'EN_COURS': s.enCours++; break
      default: s.aFaire++
    }
  }
  s.tauxAvancement = s.total ? Math.round((s.faits / s.total) * 100) : 0
  return s
}
