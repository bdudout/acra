// ─── Socle GRC — filtres partagés (cartographie / pilotage / export) ─────────
// Logique PURE de filtrage du registre : une seule définition consommée par la
// cartographie, le pilotage et les exports CSV — garantit que ce qui est affiché
// est exactement ce qui est exporté.

import { niveauBucket } from './cartographie'

export interface FilterableRisk {
  taxonomieCode: string | null
  processusId: string | null
  entite: string | null
  statut: string
  niveauInherent: number | null
  niveauResiduel: number | null
}

export interface RiskFilters {
  taxonomieCode?: string | null // '' / null = toutes
  processusId?: string | null
  entite?: string | null
  statut?: string | null
  /** Palier de niveau : 'eleve' | 'moyen' | 'faible' | 'nonCote' */
  niveau?: string | null
  /** Mode d'évaluation du palier (par défaut 'residual', repli inhérent). */
  mode?: 'inherent' | 'residual'
}

export const EMPTY_FILTERS: RiskFilters = {}

/** Palier d'un risque selon le mode (résiduel prioritaire, repli inhérent). */
export function riskNiveauBucket(r: FilterableRisk, mode: 'inherent' | 'residual' = 'residual'): string {
  const niveau = mode === 'inherent'
    ? r.niveauInherent
    : (r.niveauResiduel ?? r.niveauInherent)
  if (niveau == null) return 'nonCote'
  return niveauBucket(niveau)
}

/** Vrai si le risque satisfait TOUS les critères renseignés (ET logique). */
export function matchesFilters(r: FilterableRisk, f: RiskFilters): boolean {
  if (f.taxonomieCode) { if ((r.taxonomieCode ?? '') !== f.taxonomieCode) return false }
  if (f.processusId) { if ((r.processusId ?? '') !== f.processusId) return false }
  if (f.entite) { if ((r.entite ?? '') !== f.entite) return false }
  if (f.statut) { if (r.statut !== f.statut) return false }
  if (f.niveau) { if (riskNiveauBucket(r, f.mode ?? 'residual') !== f.niveau) return false }
  return true
}

export function applyFilters<T extends FilterableRisk>(risks: T[], f: RiskFilters): T[] {
  return risks.filter(r => matchesFilters(r, f))
}

/** Nombre de critères actifs (pour afficher un badge « n filtres »). */
export function activeFilterCount(f: RiskFilters): number {
  return [f.taxonomieCode, f.processusId, f.entite, f.statut, f.niveau].filter(Boolean).length
}

/** Normalise des paramètres d'URL en filtres (ignore les valeurs vides). */
export function parseFilters(params: { get(k: string): string | null }): RiskFilters {
  const val = (k: string) => {
    const v = params.get(k)
    return v && v.trim() ? v.trim() : null
  }
  const mode = val('mode')
  return {
    taxonomieCode: val('taxonomieCode'),
    processusId: val('processusId'),
    entite: val('entite'),
    statut: val('statut'),
    niveau: val('niveau'),
    mode: mode === 'inherent' ? 'inherent' : 'residual',
  }
}

/** Sérialise des filtres en query string (omet les critères vides). */
export function filtersToQuery(f: RiskFilters): string {
  const p = new URLSearchParams()
  if (f.taxonomieCode) p.set('taxonomieCode', f.taxonomieCode)
  if (f.processusId) p.set('processusId', f.processusId)
  if (f.entite) p.set('entite', f.entite)
  if (f.statut) p.set('statut', f.statut)
  if (f.niveau) p.set('niveau', f.niveau)
  if (f.mode === 'inherent') p.set('mode', 'inherent')
  return p.toString()
}

/** Valeurs d'entité distinctes présentes dans le registre (pour le sélecteur). */
export function distinctEntites(risks: FilterableRisk[]): string[] {
  return [...new Set(risks.map(r => r.entite).filter((e): e is string => !!e && e.trim() !== ''))].sort((a, b) => a.localeCompare(b))
}
