import { describe, it, expect } from 'vitest'
import { SCENARIOS_STRATEGIQUES_EXEMPLES } from '@/lib/ebios-data'

// ─── SCENARIOS_STRATEGIQUES_EXEMPLES ─────────────────────────────────────────

describe('SCENARIOS_STRATEGIQUES_EXEMPLES', () => {
  it('existe et contient au moins 8 exemples', () => {
    expect(Array.isArray(SCENARIOS_STRATEGIQUES_EXEMPLES)).toBe(true)
    expect(SCENARIOS_STRATEGIQUES_EXEMPLES.length).toBeGreaterThanOrEqual(8)
  })

  it('chaque exemple a les champs requis', () => {
    SCENARIOS_STRATEGIQUES_EXEMPLES.forEach(s => {
      expect(s).toHaveProperty('nom')
      expect(s).toHaveProperty('critere')
      expect(s).toHaveProperty('description')
      expect(s).toHaveProperty('vraisemblanceDefaut')
      expect(s).toHaveProperty('graviteDefaut')
      expect(s.nom).toBeTruthy()
      expect(s.description).toBeTruthy()
    })
  })

  it('le critère est toujours D, I, C ou T', () => {
    const criteres = ['D', 'I', 'C', 'T']
    SCENARIOS_STRATEGIQUES_EXEMPLES.forEach(s => {
      expect(criteres).toContain(s.critere)
    })
  })

  it('contient au moins un exemple par critère DICT', () => {
    const criteres = ['D', 'I', 'C', 'T']
    criteres.forEach(c => {
      const found = SCENARIOS_STRATEGIQUES_EXEMPLES.some(s => s.critere === c)
      expect(found, `Doit contenir au moins un scénario pour le critère ${c}`).toBe(true)
    })
  })

  it('vraisemblanceDefaut et graviteDefaut sont entre 1 et 4', () => {
    SCENARIOS_STRATEGIQUES_EXEMPLES.forEach(s => {
      expect(s.vraisemblanceDefaut).toBeGreaterThanOrEqual(1)
      expect(s.vraisemblanceDefaut).toBeLessThanOrEqual(4)
      expect(s.graviteDefaut).toBeGreaterThanOrEqual(1)
      expect(s.graviteDefaut).toBeLessThanOrEqual(4)
    })
  })
})
