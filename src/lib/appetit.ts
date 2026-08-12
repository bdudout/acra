// ─── Appétit au risque ───────────────────────────────────────────────────────
// L'appétit = le niveau de risque RÉSIDUEL maximum qu'une organisation accepte,
// exprimé sur l'échelle du niveau (produit gravité × vraisemblance, 1..25).
// Un seuil GLOBAL, surchargé au besoin PAR CATÉGORIE de taxonomie. Un risque dont
// le résiduel dépasse le seuil applicable est « hors appétit » (dépassement).
// Logique PURE et testée — l'UI et l'API ne font qu'appliquer ce moteur.

import { CARTO_MAX } from './cartographie'

export const SEUIL_MIN = 1
export const SEUIL_MAX = CARTO_MAX * CARTO_MAX // 25

export interface AppetitConfig {
  /** Seuil global (niveau max acceptable) ; null = aucun appétit défini. */
  seuilGlobal: number | null
  /** Surcharge par code de taxonomie (prioritaire sur le global). */
  parCategorie: Record<string, number>
}

export const APPETIT_DEFAULT: AppetitConfig = { seuilGlobal: null, parCategorie: {} }

/** Seuil applicable à un risque : surcharge de sa catégorie, sinon le global. */
export function seuilApplicable(cfg: AppetitConfig, taxonomieCode: string | null | undefined): number | null {
  if (taxonomieCode && Object.prototype.hasOwnProperty.call(cfg.parCategorie ?? {}, taxonomieCode)) {
    return cfg.parCategorie[taxonomieCode]
  }
  return cfg.seuilGlobal ?? null
}

export type StatutAppetit = 'DANS' | 'HORS' | 'INCONNU'

/**
 * Position d'un risque vis-à-vis de son appétit.
 * INCONNU si aucun seuil applicable OU si le risque n'est pas coté (résiduel null).
 * HORS si le niveau résiduel dépasse STRICTEMENT le seuil (le seuil est acceptable).
 */
export function evaluerAppetit(niveauResiduel: number | null, seuil: number | null): StatutAppetit {
  if (seuil == null || niveauResiduel == null) return 'INCONNU'
  return niveauResiduel > seuil ? 'HORS' : 'DANS'
}

export interface RiskAppetitLite {
  taxonomieCode: string | null
  niveauResiduel: number | null
}

export function estHorsAppetit(r: RiskAppetitLite, cfg: AppetitConfig): boolean {
  return evaluerAppetit(r.niveauResiduel, seuilApplicable(cfg, r.taxonomieCode)) === 'HORS'
}

export interface AppetitSynthese {
  total: number
  evalues: number // risques avec un seuil applicable ET cotés
  horsAppetit: number
  dansAppetit: number
  sansSeuil: number // non évaluables (pas de seuil ou non cotés)
}

export function synthetiserAppetit(risks: RiskAppetitLite[], cfg: AppetitConfig): AppetitSynthese {
  const s: AppetitSynthese = { total: risks.length, evalues: 0, horsAppetit: 0, dansAppetit: 0, sansSeuil: 0 }
  for (const r of risks) {
    const st = evaluerAppetit(r.niveauResiduel, seuilApplicable(cfg, r.taxonomieCode))
    if (st === 'INCONNU') { s.sansSeuil++; continue }
    s.evalues++
    if (st === 'HORS') s.horsAppetit++
    else s.dansAppetit++
  }
  return s
}

/** Un seuil valide est un entier dans [SEUIL_MIN, SEUIL_MAX], ou null (non défini). */
function seuilValide(v: unknown): boolean {
  if (v == null || v === '') return true
  const n = Number(v)
  return Number.isInteger(n) && n >= SEUIL_MIN && n <= SEUIL_MAX
}

/** Valide une entrée de configuration d'appétit (API PUT). null = OK. */
export function validateAppetitConfig(input: unknown): string | null {
  if (input == null || typeof input !== 'object') return 'config_invalide'
  const src = input as Record<string, unknown>
  if (!seuilValide(src.seuilGlobal)) return 'seuil_invalide'
  const pc = src.parCategorie
  if (pc != null) {
    if (typeof pc !== 'object') return 'config_invalide'
    for (const v of Object.values(pc as Record<string, unknown>)) {
      if (!seuilValide(v)) return 'seuil_invalide'
    }
  }
  return null
}

const clampSeuil = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return null
  return Math.min(SEUIL_MAX, Math.max(SEUIL_MIN, n))
}

/** Normalise une entrée de configuration : seuils bornés, catégories vides retirées. */
export function cleanAppetitConfig(input: unknown): AppetitConfig {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const parCategorie: Record<string, number> = {}
  const pc = src.parCategorie && typeof src.parCategorie === 'object' ? (src.parCategorie as Record<string, unknown>) : {}
  for (const [code, val] of Object.entries(pc)) {
    const n = clampSeuil(val)
    if (n != null && code) parCategorie[code] = n
  }
  return { seuilGlobal: clampSeuil(src.seuilGlobal), parCategorie }
}
