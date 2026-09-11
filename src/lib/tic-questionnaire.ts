// ─── Questionnaire de qualification risque/sécurité d'un prestataire TIC ──────
// Due diligence DORA (art. 28 §4) : avant/pendant la relation, le prestataire de
// services TIC est évalué sur un socle de sécurité et de risque. Ce module PUR
// définit le questionnaire type, normalise les réponses et calcule un verdict
// (score de conformité + écarts + complétude). Les réponses sont stockées en JSON
// sur l'ArrangementTic ; l'UI/API ne fait que consommer.

export interface QuestionTic {
  id: string
  theme: 'securite' | 'donnees' | 'continuite' | 'conformite' | 'contractuel'
  question: string
}

/** Socle de questions de qualification (éditable/complétable ultérieurement). */
export const QUESTIONNAIRE_TIC: QuestionTic[] = [
  { id: 'iso27001', theme: 'securite', question: 'Le prestataire est-il certifié ISO/IEC 27001 (ou équivalent) ?' },
  { id: 'preuves_secu', theme: 'securite', question: 'Fournit-il des preuves indépendantes (rapport SOC 2, tests d’intrusion) ?' },
  { id: 'chiffrement', theme: 'securite', question: 'Les données sont-elles chiffrées au repos et en transit ?' },
  { id: 'notification_incident', theme: 'securite', question: 'S’engage-t-il à notifier les incidents de sécurité dans un délai contractuel ?' },
  { id: 'localisation_donnees', theme: 'donnees', question: 'Les données sont-elles hébergées et traitées dans l’UE / EEE ?' },
  { id: 'rgpd_dpa', theme: 'donnees', question: 'Un accord de sous-traitance RGPD (DPA, art. 28) est-il signé ?' },
  { id: 'continuite', theme: 'continuite', question: 'Dispose-t-il d’un PCA/PRA testé avec des RTO/RPO définis ?' },
  { id: 'reversibilite', theme: 'continuite', question: 'Une stratégie de sortie / réversibilité est-elle prévue ?' },
  { id: 'sous_traitance', theme: 'contractuel', question: 'La sous-traitance TIC ultérieure est-elle encadrée et transparente ?' },
  { id: 'droit_audit', theme: 'contractuel', question: 'Un droit d’audit et d’inspection (client et autorités) est-il prévu au contrat ?' },
]

export const REPONSES_TIC = ['OUI', 'NON', 'PARTIEL', 'NA'] as const
export type ReponseTic = (typeof REPONSES_TIC)[number]

export interface ReponseQuestion {
  id: string
  reponse: ReponseTic
  commentaire?: string
}

const QUESTION_IDS = new Set(QUESTIONNAIRE_TIC.map((q) => q.id))
const REPONSES_SET = new Set<string>(REPONSES_TIC)

/** Ne conserve que les réponses aux questions connues, avec une réponse valide (dernière gagne). */
export function cleanReponses(v: unknown): ReponseQuestion[] {
  const arr = Array.isArray(v) ? v : []
  const byId = new Map<string, ReponseQuestion>()
  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const id = String(o.id ?? '')
    if (!QUESTION_IDS.has(id)) continue
    if (!REPONSES_SET.has(String(o.reponse))) continue
    const commentaire = typeof o.commentaire === 'string' && o.commentaire.trim() ? o.commentaire.trim().slice(0, 500) : undefined
    byId.set(id, { id, reponse: o.reponse as ReponseTic, ...(commentaire ? { commentaire } : {}) })
  }
  // Ordre stable = ordre du questionnaire.
  return QUESTIONNAIRE_TIC.filter((q) => byId.has(q.id)).map((q) => byId.get(q.id)!)
}

export interface QuestionnaireVerdict {
  total: number // nb de questions du socle
  repondu: number // nb de questions ayant une réponse
  pertinents: number // réponses hors NA
  conformes: number // réponses OUI
  partiels: number // réponses PARTIEL
  ecarts: string[] // ids des réponses NON
  score: number // % de conformité sur les pertinents (OUI=1, PARTIEL=0.5)
  complet: boolean // toutes les questions du socle sont répondues
}

/** Verdict de qualification à partir des réponses (nettoyées ou non). */
export function evaluerQuestionnaire(reponses: unknown): QuestionnaireVerdict {
  const rep = cleanReponses(reponses)
  const total = QUESTIONNAIRE_TIC.length
  const pertinentsList = rep.filter((r) => r.reponse !== 'NA')
  const conformes = rep.filter((r) => r.reponse === 'OUI').length
  const partiels = rep.filter((r) => r.reponse === 'PARTIEL').length
  const ecarts = rep.filter((r) => r.reponse === 'NON').map((r) => r.id)
  const score = pertinentsList.length ? Math.round((100 * (conformes + 0.5 * partiels)) / pertinentsList.length) : 0
  return {
    total,
    repondu: rep.length,
    pertinents: pertinentsList.length,
    conformes,
    partiels,
    ecarts,
    score,
    complet: rep.length === total,
  }
}
