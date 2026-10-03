// ─── Suivi consolidé des recommandations régulateur (ACPR / BCE / ANSSI) ─────
// Vue CONSOLIDÉE, inter-missions, des constats de source REGULATEUR et de leurs
// plans d'action. Réutilise l'objet AuditConstat du module M4 (aucune duplication)
// et n'ajoute qu'une lecture transverse orientée dialogue prudentiel : classement
// par échéance, criticité et statut, + export. Logique PURE et testée.

import { toCsvCell } from './spreadsheet-safe'

const DAY = 86_400_000
const TERMINES = new Set(['RESOLU', 'VERIFIE', 'ACCEPTE'])

/** Constat/recommandation d'un régulateur ou superviseur suivi (criticité, échéance, statut de résolution). */
export interface ConstatRegulateur {
  id: string
  intitule: string
  description: string | null
  recommandation: string | null
  criticite: number | null
  source: string // attendu 'REGULATEUR'
  statut: string // OUVERT | EN_COURS | RESOLU | ACCEPTE
  echeance: Date | string | null
  responsableAction: string | null
  /** Intitulé de la mission d'audit porteuse (traçabilité), si applicable. */
  missionIntitule: string | null
}

function parseDate(v: Date | string | null): Date | null {
  if (v == null || v === '') return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}
const estTermine = (statut: string) => TERMINES.has(statut)

/** Ne conserve que les constats de source REGULATEUR (défense en profondeur). */
export function filtrerRegulateur<T extends { source: string }>(constats: T[]): T[] {
  return constats.filter(c => c.source === 'REGULATEUR')
}

/**
 * Ne conserve que les constats de CONTRÔLE EXTERNE (4ᵉ niveau) : autorité de
 * contrôle (REGULATEUR) OU auditeur externe / commissaire aux comptes
 * (AUDITEUR_EXTERNE).
 */
export function filtrerControleExterne<T extends { source: string }>(constats: T[]): T[] {
  return constats.filter(c => c.source === 'REGULATEUR' || c.source === 'AUDITEUR_EXTERNE')
}

export interface FiltresSuiviRegulateur {
  q?: string
  statut?: string
  /** '1'…'4' ou 'NONE' (criticité non renseignée). */
  criticite?: string
  /** ECHUE (non terminé, échéance dépassée) | SOUS_30J | A_VENIR (au-delà de 30 j) | SANS (aucune échéance). */
  echeance?: 'ECHUE' | 'SOUS_30J' | 'A_VENIR' | 'SANS'
  ouvertsSeulement?: boolean
}
const plier = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Filtre les constats de la vue de suivi (texte, statut, criticité, état d'échéance) ; les filtres se cumulent. */
export function filtrerConstatsSuivi<T extends ConstatRegulateur>(constats: T[], f: FiltresSuiviRegulateur, now: Date = new Date()): T[] {
  const mots = plier(f.q ?? '').split(/\s+/).filter(Boolean)
  return constats.filter(c => {
    if (f.statut && c.statut !== f.statut) return false
    if (f.ouvertsSeulement && estTermine(c.statut)) return false
    if (f.criticite) { if (f.criticite === 'NONE' ? c.criticite != null : String(c.criticite) !== f.criticite) return false }
    if (f.echeance) {
      const d = parseDate(c.echeance)
      if (f.echeance === 'SANS') { if (d) return false }
      else {
        if (!d || estTermine(c.statut)) return false
        const delta = d.getTime() - now.getTime()
        if (f.echeance === 'ECHUE' && delta >= 0) return false
        if (f.echeance === 'SOUS_30J' && !(delta >= 0 && delta <= 30 * DAY)) return false
        if (f.echeance === 'A_VENIR' && delta <= 30 * DAY) return false
      }
    }
    if (mots.length) {
      const hay = plier([c.intitule, c.description, c.recommandation, c.responsableAction, c.missionIntitule].filter(Boolean).join(' '))
      if (!mots.every(m => hay.includes(m))) return false
    }
    return true
  })
}

/** Synthèse du suivi régulateur : total, ouverts/résolus, échus, à venir, critiques, taux de résolution. */
export interface SuiviRegulateurSynthese {
  total: number
  ouverts: number // non terminés
  resolus: number // RESOLU + ACCEPTE
  /** Non terminés dont l'échéance est passée. */
  echues: number
  /** Non terminés dont l'échéance tombe dans les 30 prochains jours. */
  sous30j: number
  /** Non terminés dont l'échéance est au-delà de 30 jours. */
  aVenir: number
  /** Non terminés sans échéance fixée. */
  sansEcheance: number
  /** Non terminés de criticité maximale (4). */
  critiques: number
  tauxResolution: number // % de constats terminés
  parCriticite: Record<1 | 2 | 3 | 4, number> // non terminés par criticité
}

/** Synthèse prudentielle du suivi régulateur (buckets d'échéance + criticité). */
export function synthetiserSuiviRegulateur(constats: ConstatRegulateur[], now: Date = new Date()): SuiviRegulateurSynthese {
  const s: SuiviRegulateurSynthese = {
    total: 0, ouverts: 0, resolus: 0, echues: 0, sous30j: 0, aVenir: 0, sansEcheance: 0,
    critiques: 0, tauxResolution: 0, parCriticite: { 1: 0, 2: 0, 3: 0, 4: 0 },
  }
  const regs = filtrerRegulateur(constats)
  s.total = regs.length
  const t30 = now.getTime() + 30 * DAY
  for (const c of regs) {
    if (estTermine(c.statut)) { s.resolus++; continue }
    s.ouverts++
    if (c.criticite === 4) s.critiques++
    if (c.criticite && c.criticite >= 1 && c.criticite <= 4) s.parCriticite[c.criticite as 1 | 2 | 3 | 4]++
    const e = parseDate(c.echeance)
    if (!e) { s.sansEcheance++; continue }
    if (e.getTime() < now.getTime()) s.echues++
    else if (e.getTime() <= t30) s.sous30j++
    else s.aVenir++
  }
  s.tauxResolution = s.total ? Math.round((s.resolus / s.total) * 100) : 0
  return s
}

/** Plus proche échéance FUTURE parmi les constats régulateur non terminés. */
export function prochaineEcheanceRegulateur(constats: ConstatRegulateur[], now: Date = new Date()): Date | null {
  let min: Date | null = null
  for (const c of filtrerRegulateur(constats)) {
    if (estTermine(c.statut)) continue
    const e = parseDate(c.echeance)
    if (!e || e.getTime() < now.getTime()) continue
    if (!min || e.getTime() < min.getTime()) min = e
  }
  return min
}

// ─── Export CSV ──────────────────────────────────────────────────────────────

export const SUIVI_REGULATEUR_CSV_HEADER = [
  'Intitulé', 'Recommandation', 'Criticité', 'Statut', 'Échéance', 'Responsable', 'Mission / source',
] as const

/** Convertit un constat régulateur en ligne CSV (cellules assainies) pour l'export du suivi. */
export function suiviRegulateurToCsvRow(c: ConstatRegulateur): string[] {
  const e = parseDate(c.echeance)
  return [
    toCsvCell(c.intitule),
    toCsvCell(c.recommandation ?? ''),
    toCsvCell(c.criticite ?? ''),
    toCsvCell(c.statut),
    toCsvCell(e ? e.toISOString().slice(0, 10) : ''),
    toCsvCell(c.responsableAction ?? ''),
    toCsvCell(c.missionIntitule ?? ''),
  ]
}
