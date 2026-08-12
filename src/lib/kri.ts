// ─── KRI — Indicateurs clés de risque (Key Risk Indicators) ──────────────────
// Un KRI est une métrique suivie périodiquement qui donne un signal AVANCÉ de
// l'évolution d'une exposition. Chaque KRI porte deux seuils (alerte, critique)
// et un SENS de dégradation : HAUSSE (plus haut = pire, ex. nb d'incidents) ou
// BAISSE (plus bas = pire, ex. taux de complétion). Le statut courant se dérive
// de la dernière mesure vs les seuils. Logique PURE et testée.

export const KRI_SENS = ['HAUSSE', 'BAISSE'] as const
export type KriSens = (typeof KRI_SENS)[number]

export const KRI_STATUTS = ['NORMAL', 'ALERTE', 'CRITIQUE', 'INCONNU'] as const
export type KriStatut = (typeof KRI_STATUTS)[number]

export const KRI_FREQUENCES = ['MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL'] as const
export type KriFrequence = (typeof KRI_FREQUENCES)[number]

export interface KriSeuils {
  sens: KriSens
  seuilAlerte: number
  seuilCritique: number
}

/** Statut d'une valeur vis-à-vis des seuils, selon le sens de dégradation. */
export function evaluerKri(valeur: number | null | undefined, def: KriSeuils): KriStatut {
  if (valeur == null || !Number.isFinite(valeur)) return 'INCONNU'
  if (def.sens === 'HAUSSE') {
    if (valeur >= def.seuilCritique) return 'CRITIQUE'
    if (valeur >= def.seuilAlerte) return 'ALERTE'
    return 'NORMAL'
  }
  if (valeur <= def.seuilCritique) return 'CRITIQUE'
  if (valeur <= def.seuilAlerte) return 'ALERTE'
  return 'NORMAL'
}

export type KriTendance = 'AMELIORATION' | 'DEGRADATION' | 'STABLE' | 'INCONNU'

/** Tendance entre la valeur courante et la précédente, selon le sens. */
export function tendanceKri(courante: number | null, precedente: number | null, sens: KriSens): KriTendance {
  if (courante == null || precedente == null) return 'INCONNU'
  if (courante === precedente) return 'STABLE'
  const hausse = courante > precedente
  // HAUSSE : une hausse dégrade ; BAISSE : une hausse améliore.
  const degradation = sens === 'HAUSSE' ? hausse : !hausse
  return degradation ? 'DEGRADATION' : 'AMELIORATION'
}

// ─── Synthèse (cockpit / liste) ──────────────────────────────────────────────

export interface KriLite {
  statut: KriStatut
}

export interface KriSynthese {
  total: number
  normal: number
  alerte: number
  critique: number
  inconnu: number
  enAlerte: number // alerte + critique (nécessitant attention)
}

export function synthetiserKri(kris: KriLite[]): KriSynthese {
  const s: KriSynthese = { total: kris.length, normal: 0, alerte: 0, critique: 0, inconnu: 0, enAlerte: 0 }
  for (const k of kris) {
    if (k.statut === 'NORMAL') s.normal++
    else if (k.statut === 'ALERTE') { s.alerte++; s.enAlerte++ }
    else if (k.statut === 'CRITIQUE') { s.critique++; s.enAlerte++ }
    else s.inconnu++
  }
  return s
}

// ─── Validation / nettoyage — définition d'un KRI ────────────────────────────

export interface KriInput {
  intitule?: unknown
  description?: unknown
  unite?: unknown
  sens?: unknown
  seuilAlerte?: unknown
  seuilCritique?: unknown
  frequence?: unknown
  responsable?: unknown
  taxonomieCode?: unknown
  riskItemId?: unknown
  processusId?: unknown
  actif?: unknown
}

export interface CleanKri {
  intitule: string
  description: string | null
  unite: string | null
  sens: KriSens
  seuilAlerte: number
  seuilCritique: number
  frequence: KriFrequence
  responsable: string | null
  taxonomieCode: string | null
  riskItemId: string | null
  processusId: string | null
  actif: boolean
}

const txt = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Valide une définition de KRI. `partial` : mise à jour (ne valider que le présent). */
export function validateKriInput(body: KriInput, opts: { partial?: boolean } = {}): string | null {
  const has = (k: keyof KriInput) => k in body
  if (!opts.partial || has('intitule')) {
    if (typeof body.intitule !== 'string' || body.intitule.trim() === '') return 'intitule_requis'
  }
  if (!opts.partial || has('sens')) {
    if (!KRI_SENS.includes(body.sens as KriSens)) return 'sens_invalide'
  }
  if (!opts.partial || has('frequence')) {
    if (body.frequence != null && !KRI_FREQUENCES.includes(body.frequence as KriFrequence)) return 'frequence_invalide'
  }
  for (const key of ['seuilAlerte', 'seuilCritique'] as const) {
    if ((!opts.partial || has(key)) && num(body[key]) == null) return 'seuil_requis'
  }
  // Cohérence : le seuil critique doit être « pire » que l'alerte selon le sens,
  // vérifiée seulement quand les deux seuils ET le sens sont connus dans le corps.
  const a = num(body.seuilAlerte), cr = num(body.seuilCritique)
  if (a != null && cr != null && KRI_SENS.includes(body.sens as KriSens)) {
    const ok = body.sens === 'HAUSSE' ? cr >= a : cr <= a
    if (!ok) return 'seuils_incoherents'
  }
  return null
}

export function cleanKriInput(body: KriInput): CleanKri {
  const sens = KRI_SENS.includes(body.sens as KriSens) ? (body.sens as KriSens) : 'HAUSSE'
  const frequence = KRI_FREQUENCES.includes(body.frequence as KriFrequence) ? (body.frequence as KriFrequence) : 'MENSUEL'
  return {
    intitule: String(body.intitule ?? '').trim(),
    description: txt(body.description),
    unite: txt(body.unite),
    sens,
    seuilAlerte: num(body.seuilAlerte) ?? 0,
    seuilCritique: num(body.seuilCritique) ?? 0,
    frequence,
    responsable: txt(body.responsable),
    taxonomieCode: txt(body.taxonomieCode),
    riskItemId: txt(body.riskItemId),
    processusId: txt(body.processusId),
    actif: typeof body.actif === 'boolean' ? body.actif : true,
  }
}

// ─── Validation / nettoyage — mesure ─────────────────────────────────────────

export interface MesureInput {
  valeur?: unknown
  dateMesure?: unknown
  commentaire?: unknown
}

export interface CleanMesure {
  valeur: number
  dateMesure: Date | null
  commentaire: string | null
}

function parseDate(v: unknown): Date | null {
  if (v == null || v === '') return null
  const d = new Date(v as string)
  return Number.isNaN(d.getTime()) ? null : d
}

export function validateMesureInput(body: MesureInput): string | null {
  if (num(body.valeur) == null) return 'valeur_requise'
  if (body.dateMesure != null && body.dateMesure !== '' && parseDate(body.dateMesure) == null) return 'date_invalide'
  return null
}

export function cleanMesureInput(body: MesureInput): CleanMesure {
  return {
    valeur: num(body.valeur) ?? 0,
    dateMesure: parseDate(body.dateMesure),
    commentaire: txt(body.commentaire),
  }
}
