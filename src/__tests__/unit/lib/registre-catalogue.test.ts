import { describe, it, expect } from 'vitest'
import { buildRegistreDefaut } from '@/lib/registre-catalogue'

describe('buildRegistreDefaut', () => {
  const items = buildRegistreDefaut()

  it('fournit un socle de risques (≥ 14, bonnes pratiques génériques)', () => {
    expect(items.length).toBeGreaterThanOrEqual(14)
  })
  it('chaque risque a un intitulé, une description et une catégorie Bâle valide', () => {
    const bale = new Set(['BALE_1', 'BALE_2', 'BALE_3', 'BALE_4', 'BALE_5', 'BALE_6', 'BALE_7'])
    for (const r of items) {
      expect(r.intitule.trim().length).toBeGreaterThan(0)
      expect(r.description.trim().length).toBeGreaterThan(0)
      expect(bale.has(r.taxonomieCode)).toBe(true)
      expect(r.proprietaire.trim().length).toBeGreaterThan(0)
    }
  })
  it('couvre les 7 catégories Bâle', () => {
    const cats = new Set(items.map(r => r.taxonomieCode))
    expect(cats.size).toBe(7)
  })
  it('intitulés uniques (pas de doublon dans le socle)', () => {
    const noms = items.map(r => r.intitule)
    expect(new Set(noms).size).toBe(noms.length)
  })
})
