import { describe, it, expect } from 'vitest'
import { buildRopaDefaut, ROPA_PLACEHOLDER_NOM } from '@/lib/ropa-catalogue'
import { champsManquantsArt30, sanitizeTraitement, BASES_LEGALES } from '@/lib/ropa'

describe('buildRopaDefaut (socle CNIL générique)', () => {
  const items = buildRopaDefaut()

  it('fournit les traitements habituels (≥ 10)', () => {
    expect(items.length).toBeGreaterThanOrEqual(10)
  })
  it('noms uniques', () => {
    const noms = items.map(t => t.nom)
    expect(new Set(noms).size).toBe(noms.length)
  })
  it('les traitements standards ont une base légale valide et sont complets (art. 30)', () => {
    const standards = items.filter(t => t.nom !== ROPA_PLACEHOLDER_NOM)
    for (const t of standards) {
      expect((BASES_LEGALES as readonly string[]).includes(t.baseLegale)).toBe(true)
      expect(champsManquantsArt30(sanitizeTraitement(t))).toEqual([])
    }
  })
  it('inclut un traitement « métier » placeholder à compléter (mis en avant comme incomplet)', () => {
    const ph = items.find(t => t.nom === ROPA_PLACEHOLDER_NOM)
    expect(ph).toBeDefined()
    expect(champsManquantsArt30(sanitizeTraitement(ph!)).length).toBeGreaterThan(0)
  })
})
