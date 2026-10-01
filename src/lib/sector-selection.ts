// ─── Secteurs d'activité d'une organisation : sélection ordonnée (PUR) ────────────────────────────────────────────────
// Le premier secteur est le secteur principal (proposé par défaut dans les suggestions). Trois secteurs au maximum.

import { SECTOR_CODES, type SectorCode } from './sector-suggestions'

export const MAX_SECTORS = 3
const isSector = (code: string): code is SectorCode => (SECTOR_CODES as readonly string[]).includes(code)

/** Coche / décoche un secteur : ajout en fin de liste, retrait, plafond respecté, code inconnu ignoré. */
export function toggleSector(current: readonly string[], code: string): string[] {
  if (!isSector(code)) return [...current]
  if (current.includes(code)) return current.filter(c => c !== code)
  return current.length >= MAX_SECTORS ? [...current] : [...current, code]
}

/** Monte ou descend un secteur d'un rang (le principal est le premier) ; sans effet aux bornes. */
export function moveSector(current: readonly string[], code: string, direction: 'up' | 'down'): string[] {
  const list = [...current]
  const i = list.indexOf(code); const j = direction === 'up' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= list.length) return list
  ;[list[i], list[j]] = [list[j], list[i]]
  return list
}

const clean = (value: unknown): SectorCode[] => Array.isArray(value) ? [...new Set(value.filter((s): s is SectorCode => typeof s === 'string' && isSector(s)))] : []

/**
 * Secteurs effectifs d'une organisation, la chaîne étant donnée du nœud vers la racine :
 * ceux qu'elle a déclarés, sinon ceux de l'ancêtre le plus proche qui en a déclaré
 * (une filiale d'un groupe multisecteur hérite de ses secteurs tant qu'elle n'en choisit pas).
 */
export function effectiveSectors(chainSelfFirst: readonly unknown[]): { own: SectorCode[]; effective: SectorCode[]; inherited: boolean } {
  const own = clean(chainSelfFirst[0])
  if (own.length) return { own, effective: own, inherited: false }
  for (const value of chainSelfFirst.slice(1)) {
    const sectors = clean(value)
    if (sectors.length) return { own, effective: sectors, inherited: true }
  }
  return { own, effective: [], inherited: false }
}

/** Valeur ALL : tous les secteurs effectifs (union des packs). Vide / TRANSVERSAL : socle seul. undefined = invalide. */
export const ALL_SECTORS = 'ALL'
export function parseSectorChoice(value: unknown, effective: readonly SectorCode[]): SectorCode[] | undefined {
  if (value === null || value === undefined || value === '' || value === 'TRANSVERSAL') return []
  if (value === ALL_SECTORS) return [...effective]
  return typeof value === 'string' && isSector(value) ? [value] : undefined
}
