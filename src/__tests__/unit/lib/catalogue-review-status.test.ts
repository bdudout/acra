import { describe, expect, it } from 'vitest'
import { SECTOR_CODES } from '@/lib/sector-suggestions'
import { SECTOR_REVIEW, reviewNotice } from '@/lib/catalogue-review-status'

describe('statut de relecture du catalogue par secteur', () => {
  it('chaque secteur a un statut ; « relu » exige un relecteur nommé et une date', () => {
    for (const code of SECTOR_CODES) {
      const r = SECTOR_REVIEW[code]
      expect(r, code).toBeDefined()
      if (r.status === 'RELU') { expect(r.reviewer?.trim(), code).toBeTruthy(); expect(r.reviewedAt, code).toMatch(/^\d{4}-\d{2}-\d{2}$/) }
    }
  })
  it('sans expert nommé, aucun secteur n’est annoncé relu', () => {
    expect(SECTOR_CODES.filter(c => SECTOR_REVIEW[c].status === 'RELU')).toEqual([])
  })
  it('l’avis liste les secteurs encore à relire parmi ceux choisis, dans l’ordre donné', () => {
    expect(reviewNotice(['SANTE', 'FINANCE'])).toEqual(['SANTE', 'FINANCE'])
    expect(reviewNotice([])).toEqual([])
  })
})
