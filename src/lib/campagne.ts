// ─── M1 v2 — Campagnes d'évaluation RCSA ─────────────────────────────────────
// Le risk manager (2ᵉ ligne) ouvre une campagne sur le registre : chaque risque
// donne lieu à une évaluation confiée à son propriétaire (1ʳᵉ ligne), qui cote
// inhérent → efficacité des contrôles → résiduel. La 2ᵉ ligne valide (principe
// des quatre-yeux : le valideur ne peut pas être l'évaluateur), puis la clôture
// applique les cotations validées au registre. Logique PURE et testée.

export const CAMPAGNE_STATUTS = ['BROUILLON', 'OUVERTE', 'CLOTUREE'] as const
export type CampagneStatut = (typeof CAMPAGNE_STATUTS)[number]

export const EVALUATION_STATUTS = ['A_COTER', 'COTEE', 'VALIDEE', 'REJETEE'] as const
export type EvaluationStatut = (typeof EVALUATION_STATUTS)[number]

// Efficacité des contrôles telle que ressentie par le propriétaire du risque
// (échelle courte ; l'efficacité MESURÉE vient du module M3).
export const EFFICACITES = ['FORTE', 'MOYENNE', 'FAIBLE', 'INEXISTANTE'] as const
export type EfficaciteControle = (typeof EFFICACITES)[number]

export const COTE_MIN = 1
export const COTE_MAX = 5

// ─── Campagne ────────────────────────────────────────────────────────────────

export interface CampagneInput {
  intitule?: unknown
  description?: unknown
  dateDebut?: unknown
  dateFin?: unknown
}

export interface CleanCampagne {
  intitule: string
  description: string | null
  dateDebut: Date | null
  dateFin: Date | null
}

function parseDate(v: unknown): Date | null {
  if (v == null || v === '') return null
  const d = new Date(v as string)
  return Number.isNaN(d.getTime()) ? null : d
}
const txt = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null

export function validateCampagneInput(body: CampagneInput): string | null {
  if (typeof body.intitule !== 'string' || body.intitule.trim() === '') return 'intitule_requis'
  for (const c of ['dateDebut', 'dateFin'] as const) {
    if (body[c] != null && body[c] !== '' && parseDate(body[c]) == null) return 'date_invalide'
  }
  const d = parseDate(body.dateDebut)
  const f = parseDate(body.dateFin)
  if (d && f && f.getTime() < d.getTime()) return 'fin_avant_debut'
  return null
}

export function cleanCampagneInput(body: CampagneInput): CleanCampagne {
  return {
    intitule: String(body.intitule).trim(),
    description: txt(body.description),
    dateDebut: parseDate(body.dateDebut),
    dateFin: parseDate(body.dateFin),
  }
}

/** Transitions : BROUILLON → OUVERTE → CLOTUREE. Aucun retour en arrière. */
export function transitionCampagneAutorisee(depuis: CampagneStatut, vers: CampagneStatut): boolean {
  if (depuis === vers) return true
  if (depuis === 'BROUILLON') return vers === 'OUVERTE'
  if (depuis === 'OUVERTE') return vers === 'CLOTUREE'
  return false
}

// ─── Évaluation ──────────────────────────────────────────────────────────────

export interface EvaluationInput {
  graviteInherente?: unknown
  vraisemblanceInherente?: unknown
  efficaciteControles?: unknown
  graviteResiduelle?: unknown
  vraisemblanceResiduelle?: unknown
  commentaire?: unknown
}

export interface CleanEvaluation {
  graviteInherente: number | null
  vraisemblanceInherente: number | null
  efficaciteControles: EfficaciteControle | null
  graviteResiduelle: number | null
  vraisemblanceResiduelle: number | null
  commentaire: string | null
}

const COTES = ['graviteInherente', 'vraisemblanceInherente', 'graviteResiduelle', 'vraisemblanceResiduelle'] as const

export function validateEvaluationInput(body: EvaluationInput): string | null {
  for (const c of COTES) {
    const v = body[c]
    if (v != null && v !== '') {
      const n = Number(v)
      if (!Number.isInteger(n) || n < COTE_MIN || n > COTE_MAX) return 'cotation_invalide'
    }
  }
  if (body.efficaciteControles != null && body.efficaciteControles !== ''
    && !EFFICACITES.includes(body.efficaciteControles as EfficaciteControle)) return 'efficacite_invalide'
  return null
}

const cote = (v: unknown): number | null =>
  v == null || v === '' ? null : Math.min(COTE_MAX, Math.max(COTE_MIN, Math.round(Number(v))))

export function cleanEvaluationInput(body: EvaluationInput): CleanEvaluation {
  const eff = body.efficaciteControles as EfficaciteControle
  return {
    graviteInherente: cote(body.graviteInherente),
    vraisemblanceInherente: cote(body.vraisemblanceInherente),
    efficaciteControles: EFFICACITES.includes(eff) ? eff : null,
    graviteResiduelle: cote(body.graviteResiduelle),
    vraisemblanceResiduelle: cote(body.vraisemblanceResiduelle),
    commentaire: txt(body.commentaire),
  }
}

/** Une évaluation est cotable dès que l'inhérent ET le résiduel sont complets. */
export function evaluationComplete(e: CleanEvaluation): boolean {
  return e.graviteInherente != null && e.vraisemblanceInherente != null
    && e.graviteResiduelle != null && e.vraisemblanceResiduelle != null
}

/**
 * Vraisemblance résiduelle SUGGÉRÉE à partir de l'inhérent et de l'efficacité
 * déclarée des contrôles : un contrôle fort réduit la vraisemblance, un contrôle
 * inexistant la laisse au niveau inhérent. Aide à la saisie, jamais imposée.
 */
export function suggestResiduel(vraisemblanceInherente: number | null, efficacite: EfficaciteControle | null): number | null {
  if (vraisemblanceInherente == null || efficacite == null) return null
  const reduction = efficacite === 'FORTE' ? 3 : efficacite === 'MOYENNE' ? 2 : efficacite === 'FAIBLE' ? 1 : 0
  return Math.max(COTE_MIN, vraisemblanceInherente - reduction)
}

/** Transitions : A_COTER → COTEE → VALIDEE|REJETEE ; REJETEE renvoie à COTEE. */
export function transitionEvaluationAutorisee(depuis: EvaluationStatut, vers: EvaluationStatut): boolean {
  if (depuis === vers) return true
  if (depuis === 'A_COTER') return vers === 'COTEE'
  if (depuis === 'COTEE') return vers === 'VALIDEE' || vers === 'REJETEE'
  if (depuis === 'REJETEE') return vers === 'COTEE'
  return false // VALIDEE est terminal
}

/**
 * Quatre-yeux : le valideur ne peut pas être celui qui a coté. Règle identique
 * à l'approbation d'analyse et aux dérogations.
 */
export function peutValider(evaluateurId: string | null, valideurId: string): boolean {
  return evaluateurId !== valideurId
}

/**
 * Statut atteint par une évaluation dès la cotation, selon la présence d'une 2ᵉ ligne.
 * 2ᵉ ligne active (défaut) : COTEE (une validation distincte, en quatre-yeux, suit).
 * 2ᵉ ligne désactivée (mode ligne unique, org non régulée) : VALIDEE — la cotation
 * de la 1ʳᵉ ligne vaut clôture, sans étape de validation séparée.
 */
export function statutApresCotation(secondeLigneActive?: boolean): EvaluationStatut {
  return secondeLigneActive === false ? 'VALIDEE' : 'COTEE'
}

// ─── Avancement ──────────────────────────────────────────────────────────────

export interface EvaluationLite { statut: string }

export interface CampagneAvancement {
  total: number
  aCoter: number
  cotees: number
  validees: number
  rejetees: number
  /** Pourcentage entier d'évaluations VALIDÉES sur le total. */
  tauxValidation: number
  /** Vrai si toutes les évaluations sont validées (campagne clôturable). */
  complete: boolean
}

export function avancementCampagne(evaluations: EvaluationLite[]): CampagneAvancement {
  const a: CampagneAvancement = { total: evaluations.length, aCoter: 0, cotees: 0, validees: 0, rejetees: 0, tauxValidation: 0, complete: false }
  for (const e of evaluations) {
    if (e.statut === 'VALIDEE') a.validees++
    else if (e.statut === 'COTEE') a.cotees++
    else if (e.statut === 'REJETEE') a.rejetees++
    else a.aCoter++
  }
  a.tauxValidation = a.total ? Math.round((a.validees / a.total) * 100) : 0
  // Une campagne sans évaluation n'est pas « complète » : il n'y a rien à clôturer.
  a.complete = a.total > 0 && a.validees === a.total
  return a
}
