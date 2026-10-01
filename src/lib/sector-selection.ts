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
