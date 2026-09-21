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

/** Option de réponse à une question de qualification (identifiant stable + libellé). */
export interface QualificationOption {
  /** Identifiant interne stable (sert de clé i18n et de valeur stockée). */
  value: string
}

/** Question native du questionnaire de qualification (identifiant stable + options). */
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
  | 'GUIDANCE_RENFORCEE'

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
  { id: 'rssiInterne', type: 'bool' }, // RSSI/responsable sécu dédié en interne ? (issue #59)
]

// ─── Personnalisation du questionnaire (par organisation) ────────────────────
// L'admin peut RENOMMER ou DÉSACTIVER une question native (sans changer son `id`
// → le moteur d'orientations reste intact) et AJOUTER des questions propres
// (informatives : elles n'alimentent pas deriveOrientations). Config PURE, testée.

export interface CustomQualQuestion {
  id: string
  label: string
  type: QualificationQuestionType
  options?: { value: string; label: string }[] // pour type 'choice'
}
/** Configuration de qualification d'une organisation : surcharges des questions natives + questions personnalisées. */
export interface QualificationConfig {
  /** Surcharge des questions natives : libellé et/ou activation (par id natif). */
  overrides: Record<string, { label?: string; enabled?: boolean }>
  /** Questions supplémentaires propres à l'organisation. */
  custom: CustomQualQuestion[]
}
export const EMPTY_QUALIFICATION_CONFIG: QualificationConfig = { overrides: {}, custom: [] }

const BUILTIN_QUAL_IDS = new Set(QUALIFICATION_QUESTIONS.map(q => q.id))

/** Identifiant sûr et stable (slug) pour une question/option personnalisée. */
function slugId(s: string): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

/** Nettoie/valide une configuration de questionnaire (overrides natifs + custom). */
export function sanitizeQualificationConfig(v: unknown): QualificationConfig {
  const out: QualificationConfig = { overrides: {}, custom: [] }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  const src = v as Record<string, unknown>

  const ov = src.overrides
  if (ov && typeof ov === 'object' && !Array.isArray(ov)) {
    for (const [id, val] of Object.entries(ov as Record<string, unknown>)) {
      if (!BUILTIN_QUAL_IDS.has(id) || !val || typeof val !== 'object') continue
      const o = val as Record<string, unknown>
      const entry: { label?: string; enabled?: boolean } = {}
      if (typeof o.label === 'string' && o.label.trim()) entry.label = o.label.trim().slice(0, 200)
      if (typeof o.enabled === 'boolean') entry.enabled = o.enabled
      if (Object.keys(entry).length) out.overrides[id] = entry
    }
  }

  const seen = new Set<string>(BUILTIN_QUAL_IDS)
  const cs = Array.isArray(src.custom) ? src.custom : []
  for (const raw of cs) {
    if (!raw || typeof raw !== 'object') continue
    const q = raw as Record<string, unknown>
    const label = typeof q.label === 'string' ? q.label.trim().slice(0, 200) : ''
    if (!label) continue
    const id = slugId(typeof q.id === 'string' && q.id.trim() ? q.id : label)
    if (!id || seen.has(id)) continue // vide ou collision (natif ou déjà pris) → ignoré
    const type: QualificationQuestionType = q.type === 'choice' ? 'choice' : 'bool'
    const cq: CustomQualQuestion = { id, label, type }
    if (type === 'choice') {
      const opts = Array.isArray(q.options) ? q.options : []
      const clean: { value: string; label: string }[] = []
      const ovals = new Set<string>()
      for (const o of opts) {
        if (!o || typeof o !== 'object') continue
        const oo = o as Record<string, unknown>
        const olabel = typeof oo.label === 'string' ? oo.label.trim().slice(0, 120) : ''
        const ovalue = slugId(typeof oo.value === 'string' && oo.value.trim() ? oo.value : olabel)
        if (!olabel || !ovalue || ovals.has(ovalue)) continue
        ovals.add(ovalue); clean.push({ value: ovalue, label: olabel })
      }
      if (clean.length < 2) continue // un choix a besoin d'au moins 2 options
      cq.options = clean
    }
    seen.add(id); out.custom.push(cq)
  }
  return out
}

/** Question de qualification effective (native + surcharges org fusionnées) présentée à l'utilisateur. */
export interface EffectiveQualQuestion {
  id: string
  type: QualificationQuestionType
  options?: QualificationOption[]
  builtin: boolean
}

/**
 * Questions EFFECTIVES du questionnaire : natives activées (dans l'ordre) puis
 * questions personnalisées. Les libellés sont résolus par l'appelant (i18n pour
 * les natives sauf override ; config pour les custom).
 */
export function effectiveQualificationQuestions(config?: QualificationConfig | null): EffectiveQualQuestion[] {
  const c = config ?? EMPTY_QUALIFICATION_CONFIG
  const out: EffectiveQualQuestion[] = []
  for (const q of QUALIFICATION_QUESTIONS) {
    if (c.overrides[q.id]?.enabled === false) continue
    out.push({ id: q.id, type: q.type, options: q.options, builtin: true })
  }
  for (const q of c.custom) {
    out.push({ id: q.id, type: q.type, options: q.options?.map(o => ({ value: o.value })), builtin: false })
  }
  return out
}

/**
 * Filtre des réponses brutes : ne conserve que les questions connues avec une
 * valeur du bon type (booléen pour 'bool', valeur d'option pour 'choice').
 * Pur — utilisé côté API avant persistance.
 */
export function sanitizeQualification(answers: unknown, config?: QualificationConfig | null): QualificationAnswers {
  const out: QualificationAnswers = {}
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return out
  const src = answers as Record<string, unknown>
  // Questions effectives = natives activées + personnalisées (selon la config org).
  for (const q of effectiveQualificationQuestions(config)) {
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
  // Champ optionnel hors questionnaire : entité financière agréée ACPR/AMF (issue #106)
  // — conditionne le maintien de DORA pour une petite entité finance réglementée.
  if (typeof src.entiteFinanciereAgreee === 'boolean') out.entiteFinanciereAgreee = src.entiteFinanciereAgreee
  return out
}

/** Vrai si chaque question EFFECTIVE (natives activées + custom) a reçu une réponse. */
export function isQualificationComplete(answers: QualificationAnswers | null | undefined, config?: QualificationConfig | null): boolean {
  if (!answers || typeof answers !== 'object') return false
  return effectiveQualificationQuestions(config).every(q => answers[q.id] !== undefined && answers[q.id] !== null)
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
  // Absence de RSSI dédié → guidance renforcée (définitions, exemples, mode Flash) (#59)
  if (answers.rssiInterne === false) add('GUIDANCE_RENFORCEE')

  return out
}
