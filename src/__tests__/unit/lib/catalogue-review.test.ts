import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCatalogueReviewRows, catalogueReviewCsv, REVIEW_COLUMNS, addedIn } from '@/lib/catalogue-review'

describe('grille de revue métier du catalogue', () => {
  it('une ligne par élément, libellés dans les 5 langues, colonnes d’avis vides', () => {
    const rows = buildCatalogueReviewRows()
    expect(new Set(rows.map(r => r[0])).size).toBe(rows.length)
    for (const row of rows) {
      expect(row).toHaveLength(REVIEW_COLUMNS.length)
      for (const label of row.slice(6, 11)) expect(label.trim(), row[0]).not.toBe('')
      expect(row.slice(-2)).toEqual(['', ''])
    }
    expect(addedIn('core.process.govern')).toBe('1.0')
    expect(addedIn('finance.control.reconciliation')).toBe('1.5')
  })

  it('le fichier docs/specs/catalogue-revue-grille.csv est à jour (sinon : npm run catalogue:review)', () => {
    expect(readFileSync('docs/specs/catalogue-revue-grille.csv', 'utf8')).toBe(catalogueReviewCsv())
  })
})
