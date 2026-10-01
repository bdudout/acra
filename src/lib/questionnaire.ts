/**
 * Questionnaires de contrôle permanent (module PUR, cf. docs/specs/questionnaires-controle.md).
 *  - Questions d'un modèle : libellé, type, obligatoire, preuve requise, cible (point de contrôle,
 *    exigence d'un référentiel, risque, processus).
 *  - Mode « exigences à justifier » : une question OUI_NON + preuve par exigence choisie.
 *  - Réponses du métier (valeur, commentaire, preuves bornées), contrôle de complétude à la soumission.
 *  - Revue du contrôleur par question (ACCEPTEE | A_COMPLETER | NON_CONFORME) et statut résultant.
 */
import { sanitizePreuves, type Preuve } from './preuves'

export const QUESTION_TYPES = ['OUI_NON', 'CHOIX', 'TEXTE', 'NOMBRE', 'DATE'] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]
export const CIBLE_TYPES = ['CONTROLE', 'EXIGENCE', 'RISQUE', 'PROCESSUS'] as const
export type CibleType = (typeof CIBLE_TYPES)[number]
export const REPONSE_STATUTS = ['A_REPONDRE', 'SOUMISE', 'A_COMPLETER', 'REVUE'] as const
export type ReponseStatut = (typeof REPONSE_STATUTS)[number]
export const REVUE_STATUTS = ['ACCEPTEE', 'A_COMPLETER', 'NON_CONFORME'] as const
export type RevueStatut = (typeof REVUE_STATUTS)[number]

export const MAX_QUESTIONS = 100
export const MAX_PREUVES_PAR_QUESTION = 3
export const MAX_PREUVES_PAR_REPONSE = 15

/** Cible d'une question : un point de contrôle, une exigence, un risque ou un processus de l'organisation. */
export type Cible =
  | { type: 'CONTROLE' | 'RISQUE' | 'PROCESSUS'; id: string }
  | { type: 'EXIGENCE'; referentielCode: string; ref: string }

export interface Question {
  id: string
  libelle: string
  type: QuestionType
  choix?: string[]
  obligatoire: boolean
  preuveRequise: boolean
  cible?: Cible
}

export interface Revue { statut: RevueStatut; commentaire?: string; par: string; le: string }

export interface Reponse {
  questionId: string
  valeur: string | number | boolean | null
  commentaire?: string
  preuves: Preuve[]
  revue?: Revue
}

const has = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v)
const txt = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : '')
const ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/

function cleanCible(v: unknown): Cible | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  if (o.type === 'EXIGENCE') {
    const referentielCode = txt(o.referentielCode, 80); const ref = txt(o.ref, 80)
    return referentielCode && ref ? { type: 'EXIGENCE', referentielCode, ref } : undefined
  }
  if (has(['CONTROLE', 'RISQUE', 'PROCESSUS'] as const, o.type)) {
    const id = txt(o.id, 64)
    return id ? { type: o.type, id } : undefined
  }
  return undefined
}

/** Nettoie les questions d'un modèle : bornes, types connus, identifiants stables et uniques. */
export function sanitizeQuestions(v: unknown): Question[] {
  if (!Array.isArray(v)) return []
  const out: Question[] = []
  const ids = new Set<string>()
  for (const raw of v) {
    if (out.length >= MAX_QUESTIONS) break
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const libelle = txt(o.libelle, 500)
    if (!libelle || !has(QUESTION_TYPES, o.type)) continue
    const choix = o.type === 'CHOIX' && Array.isArray(o.choix)
      ? [...new Set(o.choix.map(c => txt(c, 120)).filter(Boolean))].slice(0, 20) : undefined
    if (o.type === 'CHOIX' && (!choix || choix.length < 2)) continue
    let id = typeof o.id === 'string' && ID_RE.test(o.id) ? o.id : ''
    if (!id || ids.has(id)) { let n = out.length + 1; while (ids.has(`q${n}`)) n++; id = `q${n}` }
    ids.add(id)
    const cible = cleanCible(o.cible)
    out.push({ id, libelle, type: o.type, ...(choix ? { choix } : {}), obligatoire: o.obligatoire !== false, preuveRequise: o.preuveRequise === true, ...(cible ? { cible } : {}) })
  }
  return out
}

/** Mode « exigences à justifier » : une question « conforme ? » avec preuve par exigence choisie. */
export function questionsDepuisExigences(referentielCode: string, exigences: { ref: string; nom: string }[], libelle: (e: { ref: string; nom: string }) => string): Question[] {
  return sanitizeQuestions(exigences.map((e, i) => ({
    id: `ex${i + 1}`, libelle: libelle(e), type: 'OUI_NON', obligatoire: true, preuveRequise: true,
    cible: { type: 'EXIGENCE', referentielCode, ref: e.ref },
  })))
}

function cleanValeur(q: Question, v: unknown): Reponse['valeur'] {
  if (v === null || v === undefined || v === '') return null
  switch (q.type) {
    case 'OUI_NON': return typeof v === 'boolean' ? v : null
    case 'NOMBRE': { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : null }
    case 'CHOIX': return typeof v === 'string' && q.choix?.includes(v) ? v : null
    case 'DATE': return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime()) ? v : null
    default: return txt(v, 4000) || null
  }
}

/**
 * Nettoie les réponses fournies par le répondant pour les questions de l'envoi : questions inconnues
 * écartées, valeur typée, preuves bornées (par question et au total). La revue existante est conservée
 * (le répondant ne peut pas la modifier).
 */
export function sanitizeReponses(questions: Question[], input: unknown, existantes: Reponse[] = []): Reponse[] {
  const byId = new Map(questions.map(q => [q.id, q]))
  const revues = new Map(existantes.map(r => [r.questionId, r.revue]))
  const seen = new Set<string>()
  let totalPreuves = 0
  const out: Reponse[] = []
  for (const raw of Array.isArray(input) ? input : []) {
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const q = typeof o.questionId === 'string' ? byId.get(o.questionId) : undefined
    if (!q || seen.has(q.id)) continue
    seen.add(q.id)
    const preuves = sanitizePreuves(o.preuves).slice(0, Math.max(0, Math.min(MAX_PREUVES_PAR_QUESTION, MAX_PREUVES_PAR_REPONSE - totalPreuves)))
    totalPreuves += preuves.length
    const commentaire = txt(o.commentaire, 2000)
    const revue = revues.get(q.id)
    out.push({ questionId: q.id, valeur: cleanValeur(q, o.valeur), ...(commentaire ? { commentaire } : {}), preuves, ...(revue ? { revue } : {}) })
  }
  return out
}

/** Questions qui empêchent la soumission : réponse obligatoire absente ou preuve requise manquante. */
export function questionsIncompletes(questions: Question[], reponses: Reponse[]): string[] {
  const byId = new Map(reponses.map(r => [r.questionId, r]))
  return questions.filter(q => {
    const r = byId.get(q.id)
    return (q.obligatoire && (r?.valeur === null || r?.valeur === undefined)) || (q.preuveRequise && !(r?.preuves.length))
  }).map(q => q.id)
}

export const peutRepondre = (statut: string) => statut === 'A_REPONDRE' || statut === 'A_COMPLETER'
export const peutReviser = (statut: string) => statut === 'SOUMISE'

/**
 * Applique la revue du contrôleur, question par question. Toutes les questions répondues doivent être
 * revues. Statut résultant : A_COMPLETER si au moins une question est renvoyée au métier, sinon REVUE.
 */
export function appliquerRevue(reponses: Reponse[], input: unknown, ctx: { acteur: string; now: Date }):
  { ok: true; reponses: Reponse[]; statut: 'A_COMPLETER' | 'REVUE' } | { ok: false; error: 'revue_incomplete' | 'commentaire_requis' } {
  const revues = new Map<string, { statut: RevueStatut; commentaire: string }>()
  for (const raw of Array.isArray(input) ? input : []) {
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    if (typeof o.questionId === 'string' && has(REVUE_STATUTS, o.statut)) revues.set(o.questionId, { statut: o.statut, commentaire: txt(o.commentaire, 2000) })
  }
  if (reponses.some(r => !revues.has(r.questionId))) return { ok: false, error: 'revue_incomplete' }
  // Renvoyer au métier ou constater une non-conformité exige d'en dire la raison.
  if ([...revues.values()].some(r => r.statut !== 'ACCEPTEE' && !r.commentaire)) return { ok: false, error: 'commentaire_requis' }
  const le = ctx.now.toISOString()
  const next = reponses.map(r => {
    const v = revues.get(r.questionId)!
    return { ...r, revue: { statut: v.statut, ...(v.commentaire ? { commentaire: v.commentaire } : {}), par: ctx.acteur, le } }
  })
  return { ok: true, reponses: next, statut: next.some(r => r.revue!.statut === 'A_COMPLETER') ? 'A_COMPLETER' : 'REVUE' }
}

/**
 * Non-conformités revues portant sur des exigences : alimentent la conformité constatée. `reprises`
 * (« reponseId|questionId ») écarte celles déjà suivies par une préconisation (comptée à part).
 */
export function nonConformitesExigences(
  envois: { questions: unknown; reponses: { id?: string; statut: string; reponses: unknown }[] }[],
  reprises: ReadonlySet<string> = new Set(),
): { referentielCode: string; ref: string }[] {
  const out: { referentielCode: string; ref: string }[] = []
  for (const envoi of envois) {
    const questions = new Map(sanitizeQuestions(envoi.questions).map(q => [q.id, q]))
    for (const rep of envoi.reponses) {
      for (const r of Array.isArray(rep.reponses) ? rep.reponses as Reponse[] : []) {
        const cible = questions.get(r?.questionId)?.cible
        if (r?.revue?.statut !== 'NON_CONFORME' || cible?.type !== 'EXIGENCE') continue
        if (rep.id && reprises.has(`${rep.id}|${r.questionId}`)) continue
        out.push({ referentielCode: cible.referentielCode, ref: cible.ref })
      }
    }
  }
  return out
}

/**
 * Anomalies de contrôle issues d'une revue : chaque question NON_CONFORME rattachée à un point de
 * contrôle devient une exécution « anomalie » de ce contrôle (commentaire du contrôleur, preuves
 * du répondant). Une préconisation reste facultative.
 */
export function anomaliesControles(questions: Question[], reponses: Reponse[]):
  { controleId: string; questionId: string; libelle: string; commentaire: string; preuves: Preuve[] }[] {
  const parId = new Map(questions.map(q => [q.id, q]))
  return reponses.flatMap(r => {
    const q = parId.get(r.questionId)
    if (r.revue?.statut !== 'NON_CONFORME' || q?.cible?.type !== 'CONTROLE') return []
    return [{ controleId: q.cible.id, questionId: q.id, libelle: q.libelle, commentaire: r.revue.commentaire ?? '', preuves: r.preuves ?? [] }]
  })
}

