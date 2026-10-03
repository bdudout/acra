// ─── Statut de relecture du catalogue sectoriel (PUR) ────────────────────────────────────────────────────────────────
// Un contenu sectoriel n'est JAMAIS annoncé « relu » sans expert nommé et date : tant qu'aucun relecteur n'est renseigné,
// l'application affiche « à relire par un expert du secteur » (points de départ à qualifier, pas une doctrine).
import type { SectorCode } from './sector-suggestions'
import { SECTOR_CODES } from './sector-suggestions'

export type ReviewStatus = 'A_RELIRE' | 'RELU'
export interface SectorReview { status: ReviewStatus; reviewer?: string; reviewedAt?: string }

/** À renseigner après relecture par un expert : { status: 'RELU', reviewer: 'Nom, fonction', reviewedAt: 'AAAA-MM-JJ' }. */
export const SECTOR_REVIEW: Record<SectorCode, SectorReview> = Object.fromEntries(SECTOR_CODES.map(code => [code, { status: 'A_RELIRE' } as SectorReview])) as Record<SectorCode, SectorReview>

/** Secteurs encore à relire parmi ceux qui sont choisis (ordre conservé). */
export function reviewNotice(sectors: readonly SectorCode[]): SectorCode[] {
  return sectors.filter(code => SECTOR_REVIEW[code]?.status !== 'RELU')
}
