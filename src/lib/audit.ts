// ─── Module M4 — Audit interne (3ᵉ ligne de défense) ─────────────────────────
// L'auditeur planifie des MISSIONS (périmètre = processus/entités), formule des
// CONSTATS (criticité + recommandation) et suit leur résolution. Les constats
// régulateur (ACPR/BCE) sont le même objet, source différente. Cloisonnement :
// seul l'auditeur écrit ; les autres consultent. Logique PURE et testée.

import { cleanChecklist, cleanChecklistResultats, cleanExigenceRefs, type ChecklistResultat } from './controle'

export const MISSION_STATUTS = ['PLANIFIEE', 'EN_COURS', 'CLOTUREE'] as const
export type MissionStatut = (typeof MISSION_STATUTS)[number]

export const CONSTAT_SOURCES = ['AUDIT_INTERNE', 'REGULATEUR'] as const
export type ConstatSource = (typeof CONSTAT_SOURCES)[number]

// Suivi d'un constat/recommandation : ouvert → en cours → résolu (ou accepté
// par la direction si le risque est assumé sans remédiation).
export const CONSTAT_STATUTS = ['OUVERT', 'EN_COURS', 'RESOLU', 'ACCEPTE'] as const
export type ConstatStatut = (typeof CONSTAT_STATUTS)[number]

export const CRITICITE_MIN = 1
export const CRITICITE_MAX = 4

// ─── Mission ─────────────────────────────────────────────────────────────────

export interface MissionInput {
  intitule?: unknown
  objectif?: unknown
  perimetre?: unknown
  responsable?: unknown
  dateDebut?: unknown
  dateFin?: unknown
  programme?: unknown
  programmeResultats?: unknown
  processusIds?: unknown
  controleIds?: unknown
}

export interface CleanMission {
  intitule: string
  objectif: string | null
  perimetre: string | null
  responsable: string | null
  dateDebut: Date | null
  dateFin: Date | null
  /** Programme d'audit : points de revue (checklist). */
  programme: string[]
  /** Cotation du programme (à la clôture) : [{label, statut, commentaire?}]. */
  programmeResultats: ChecklistResultat[]
  /** Périmètre audité (N3→N1/N2) : processus et contrôles couverts. */
  processusIds: string[]
  controleIds: string[]
}

function parseDate(v: unknown): Date | null {
  if (v == null || v === '') return null
  const d = new Date(v as string)
  return Number.isNaN(d.getTime()) ? null : d
}
const txt = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null

export function validateMissionInput(body: MissionInput, opts: { partial?: boolean } = {}): string | null {
  // Sur une mise à jour PARTIELLE, on ne valide que les champs présents :
  // l'intitulé n'est requis qu'à la création (ou s'il est fourni).
  const intitulePresent = 'intitule' in body
  if (!opts.partial || intitulePresent) {
    if (typeof body.intitule !== 'string' || body.intitule.trim() === '') return 'intitule_requis'
  }
  for (const c of ['dateDebut', 'dateFin'] as const) {
    if (body[c] != null && body[c] !== '' && parseDate(body[c]) == null) return 'date_invalide'
  }
  const d = parseDate(body.dateDebut)
  const f = parseDate(body.dateFin)
  if (d && f && f.getTime() < d.getTime()) return 'fin_avant_debut'
  return null
}

export function cleanMissionInput(body: MissionInput): CleanMission {
  return {
    intitule: String(body.intitule).trim(),
    objectif: txt(body.objectif),
    perimetre: txt(body.perimetre),
    responsable: txt(body.responsable),
    dateDebut: parseDate(body.dateDebut),
    dateFin: parseDate(body.dateFin),
    programme: cleanChecklist(body.programme),
    programmeResultats: cleanChecklistResultats(body.programmeResultats),
    processusIds: cleanExigenceRefs(body.processusIds),
    controleIds: cleanExigenceRefs(body.controleIds),
  }
}

/** Transitions : PLANIFIEE → EN_COURS → CLOTUREE. Aucun retour en arrière. */
export function transitionMissionAutorisee(depuis: MissionStatut, vers: MissionStatut): boolean {
  if (depuis === vers) return true
  if (depuis === 'PLANIFIEE') return vers === 'EN_COURS'
  if (depuis === 'EN_COURS') return vers === 'CLOTUREE'
  return false
}

// ─── Constat / recommandation ────────────────────────────────────────────────

export interface ConstatInput {
  intitule?: unknown
  description?: unknown
  recommandation?: unknown
  criticite?: unknown
  source?: unknown
  responsableAction?: unknown
  echeance?: unknown
  riskItemId?: unknown
  statut?: unknown
  referentielCode?: unknown
  exigenceRef?: unknown
}

export interface CleanConstat {
  intitule: string
  description: string | null
  recommandation: string | null
  criticite: number | null
  source: ConstatSource
  responsableAction: string | null
  echeance: Date | null
  riskItemId: string | null
  statut: ConstatStatut
  referentielCode: string | null
  exigenceRef: string | null
}

export function validateConstatInput(body: ConstatInput, opts: { partial?: boolean } = {}): string | null {
  const intitulePresent = 'intitule' in body
  if (!opts.partial || intitulePresent) {
    if (typeof body.intitule !== 'string' || body.intitule.trim() === '') return 'intitule_requis'
  }
  if (body.criticite != null && body.criticite !== '') {
    const n = Number(body.criticite)
    if (!Number.isInteger(n) || n < CRITICITE_MIN || n > CRITICITE_MAX) return 'criticite_invalide'
  }
  if (body.source != null && !CONSTAT_SOURCES.includes(body.source as ConstatSource)) return 'source_invalide'
  if (body.echeance != null && body.echeance !== '' && parseDate(body.echeance) == null) return 'echeance_invalide'
  if (body.statut != null && !CONSTAT_STATUTS.includes(body.statut as ConstatStatut)) return 'statut_invalide'
  return null
}

export function cleanConstatInput(body: ConstatInput): CleanConstat {
  const src = body.source as ConstatSource
  const st = body.statut as ConstatStatut
  return {
    intitule: String(body.intitule).trim(),
    description: txt(body.description),
    recommandation: txt(body.recommandation),
    criticite: body.criticite == null || body.criticite === '' ? null
      : Math.min(CRITICITE_MAX, Math.max(CRITICITE_MIN, Math.round(Number(body.criticite)))),
    source: CONSTAT_SOURCES.includes(src) ? src : 'AUDIT_INTERNE',
    responsableAction: txt(body.responsableAction),
    echeance: parseDate(body.echeance),
    riskItemId: txt(body.riskItemId),
    statut: CONSTAT_STATUTS.includes(st) ? st : 'OUVERT',
    referentielCode: txt(body.referentielCode),
    exigenceRef: txt(body.exigenceRef),
  }
}

/** Un constat est terminal quand il est RÉSOLU ou ACCEPTÉ (plus de suivi actif). */
export function constatTermine(statut: ConstatStatut): boolean {
  return statut === 'RESOLU' || statut === 'ACCEPTE'
}

/** Recommandation en retard : échéance dépassée et constat non terminé. */
export function constatEnRetard(c: { echeance: Date | string | null; statut: string }, now: Date = new Date()): boolean {
  if (constatTermine(c.statut as ConstatStatut)) return false
  if (!c.echeance) return false
  const e = new Date(c.echeance)
  return !Number.isNaN(e.getTime()) && e.getTime() < now.getTime()
}

// ─── Synthèse ────────────────────────────────────────────────────────────────

export interface ConstatLite {
  criticite: number | null
  statut: string
  echeance: Date | string | null
}

export interface ConstatsSynthese {
  total: number
  ouverts: number // OUVERT + EN_COURS
  resolus: number // RESOLU + ACCEPTE
  enRetard: number
  critiques: number // criticité maximale (4), non terminés
  tauxResolution: number // % de constats terminés
}

export function synthetiserConstats(constats: ConstatLite[], now: Date = new Date()): ConstatsSynthese {
  const s: ConstatsSynthese = { total: constats.length, ouverts: 0, resolus: 0, enRetard: 0, critiques: 0, tauxResolution: 0 }
  for (const c of constats) {
    const termine = constatTermine(c.statut as ConstatStatut)
    if (termine) s.resolus++
    else s.ouverts++
    if (constatEnRetard(c, now)) s.enRetard++
    if (!termine && c.criticite === CRITICITE_MAX) s.critiques++
  }
  s.tauxResolution = s.total ? Math.round((s.resolus / s.total) * 100) : 0
  return s
}
