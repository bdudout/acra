/**
 * qualification.ts — Questionnaire de qualification d'une analyse (optionnel).
 *
 * Fonctionnalité activable (OrganizationConfig.qualificationActive) proposée au
 * DÉBUT d'une analyse pour la cadrer : externalisation, criticité, données
 * personnelles, exposition, réglementation, OT… Les réponses produisent des
 * « orientations » qui guident la suite de l'étude (sans rien imposer).
 *
 * Ce module est STRUCTUREL et pur (pas de React, pas de DB, pas de libellés) :
 * les libellés des questions/options viennent de l'i18n (t.qualification.*),
 * indexés par les `id`/`value` définis ici. Testé dans
 * src/__tests__/unit/lib/qualification.test.ts.
 */

export type QualificationQuestionType = 'bool' | 'choice'

export interface QualificationOption {
  /** Identifiant interne stable (sert de clé i18n et de valeur stockée). */
  value: string
}

export interface QualificationQuestion {
  /** Identifiant interne stable (clé i18n + clé de réponse). */
  id: string
  type: QualificationQuestionType
  /** Pour type 'choice' uniquement. */
  options?: QualificationOption[]
}

/** Réponses saisies : { <questionId>: boolean | optionValue }. */
export type QualificationAnswers = Record<string, boolean | string>

/** Orientations dérivées des réponses (clés i18n t.qualification.orientations.*). */
export type Orientation =
  | 'ECOSYSTEME'
  | 'CONFIDENTIALITE'
  | 'EXPOSITION'
  | 'CONFORMITE'
  | 'DISPONIBILITE_OT'
  | 'ANALYSE_ALLEGEE'
  | 'ANALYSE_APPROFONDIE'

const CRITICITE_OPTIONS: QualificationOption[] = [
  { value: 'faible' },
  { value: 'modere' },
  { value: 'eleve' },
]

// Statut réglementaire de l'entité (NIS2 / LPM). Marqueur dédié au-delà de la
// simple question « réglementation » : oriente l'emphase conformité (NIS2 Art.21).
const STATUT_REGLEMENTAIRE_OPTIONS: QualificationOption[] = [
  { value: 'aucun' },
  { value: 'OSE' },   // Opérateur de services essentiels (NIS1, hérité)
  { value: 'EEI' },   // Entité essentielle ou importante (NIS2)
  { value: 'OIV' },   // Opérateur d'importance vitale (LPM)
]

// Filières OIV (secteurs d'activité d'importance vitale, SGDSN) — champ OPTIONNEL
// affiché uniquement si statutReglementaire = OIV, pour pointer vers l'arrêté SIIV
// et le HFDS compétents (issue #80). Hors questionnaire de complétude.
export const FILIERE_OIV_OPTIONS: QualificationOption[] = [
  { value: 'civil' },        // Activités civiles de l'État
  { value: 'judiciaire' },   // Activités judiciaires
  { value: 'militaire' },    // Activités militaires de l'État
  { value: 'alimentation' }, // Alimentation
  { value: 'communication' },// Communications électroniques, audiovisuel et information
  { value: 'energie' },      // Énergie
  { value: 'espace' },       // Espace et recherche
  { value: 'finances' },     // Finances
  { value: 'eau' },          // Gestion de l'eau
  { value: 'industrie' },    // Industrie
  { value: 'sante' },        // Santé
  { value: 'transports' },   // Transports
]

/** Questionnaire de qualification standard (libellés via i18n). */
export const QUALIFICATION_QUESTIONS: QualificationQuestion[] = [
  { id: 'externalisation', type: 'bool' },
  { id: 'criticite', type: 'choice', options: CRITICITE_OPTIONS },
  { id: 'donneesPersonnelles', type: 'bool' },
  { id: 'expositionInternet', type: 'bool' },
  { id: 'reglementation', type: 'bool' },
  { id: 'statutReglementaire', type: 'choice', options: STATUT_REGLEMENTAIRE_OPTIONS },
  { id: 'systemeIndustriel', type: 'bool' },
]

/**
 * Filtre des réponses brutes : ne conserve que les questions connues avec une
 * valeur du bon type (booléen pour 'bool', valeur d'option pour 'choice').
 * Pur — utilisé côté API avant persistance.
 */
export function sanitizeQualification(answers: unknown): QualificationAnswers {
  const out: QualificationAnswers = {}
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return out
  const src = answers as Record<string, unknown>
  for (const q of QUALIFICATION_QUESTIONS) {
    const v = src[q.id]
    if (q.type === 'bool') {
      if (typeof v === 'boolean') out[q.id] = v
    } else if (q.type === 'choice') {
      if (typeof v === 'string' && (q.options ?? []).some(o => o.value === v)) out[q.id] = v
    }
  }
  // Champ optionnel hors questionnaire : filière OIV (issue #80)
  const fil = src.filiereOiv
  if (typeof fil === 'string' && FILIERE_OIV_OPTIONS.some(o => o.value === fil)) out.filiereOiv = fil
  return out
}

/** Vrai si chaque question du questionnaire a reçu une réponse. */
export function isQualificationComplete(answers: QualificationAnswers | null | undefined): boolean {
  if (!answers || typeof answers !== 'object') return false
  return QUALIFICATION_QUESTIONS.every(q => answers[q.id] !== undefined && answers[q.id] !== null)
}

/**
 * Dérive les orientations à partir des réponses. Pur, sans effet de bord,
 * sans doublons. Une réponse neutre ne produit aucune orientation.
 */
export function deriveOrientations(answers: QualificationAnswers | null | undefined): Orientation[] {
  const out: Orientation[] = []
  if (!answers || typeof answers !== 'object') return out
  const add = (o: Orientation) => { if (!out.includes(o)) out.push(o) }

  if (answers.externalisation === true) add('ECOSYSTEME')
  if (answers.donneesPersonnelles === true) add('CONFIDENTIALITE')
  if (answers.expositionInternet === true) add('EXPOSITION')
  if (answers.reglementation === true) add('CONFORMITE')
  if (typeof answers.statutReglementaire === 'string' && answers.statutReglementaire !== 'aucun') add('CONFORMITE')
  if (answers.systemeIndustriel === true) add('DISPONIBILITE_OT')
  if (answers.criticite === 'faible') add('ANALYSE_ALLEGEE')
  if (answers.criticite === 'eleve') add('ANALYSE_APPROFONDIE')

  return out
}
