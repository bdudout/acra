// ─── Socle GRC — M2 : plan d'action / traitement rattaché à un RiskItem ──────
// Une action de traitement (mesure) portée par un risque du registre canonique.
// Logique PURE : validation, normalisation, statut effectif (retard dérivé de
// l'échéance) et synthèse d'avancement. L'UI/API ne fait que consommer.

export const RISK_ACTION_STATUTS = ['A_FAIRE', 'EN_COURS', 'FAIT'] as const
export type RiskActionStatut = (typeof RISK_ACTION_STATUTS)[number]
// Le retard n'est PAS stocké : il se dérive de l'échéance vs. aujourd'hui.
export type EffectiveStatut = RiskActionStatut | 'EN_RETARD'

export interface RiskActionInput {
  intitule?: unknown
  description?: unknown
  responsable?: unknown
  echeance?: unknown // 'YYYY-MM-DD' | ISO | null
  statut?: unknown
}

export interface CleanRiskAction {
  intitule: string
  description: string | null
  responsable: string | null
  echeance: Date | null
  statut: RiskActionStatut
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
