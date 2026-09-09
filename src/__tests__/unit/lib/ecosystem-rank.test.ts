import { describe, it, expect } from 'vitest'
import { menaceTier, rankEcosystemTiers } from '@/lib/ecosystem-rank'

const t = (id: string, exposition: number, fiabilite: number, critique = false) => ({ id, exposition, fiabilite, critique })

describe('menaceTier', () => {
  it('classe par niveau de menace = exposition / fiabilité', () => {
    expect(menaceTier(12, 3)).toBeGreaterThan(menaceTier(6, 3)) // 4 > 2
    expect(menaceTier(10, 0)).toBe(10) // fiabilité 0 → exposition brute
  })
})

describe('rankEcosystemTiers', () => {
  it('priorise les critiques, puis la menace, puis l’exposition ; plafonne à max', () => {
    const parties = [
      t('faible', 2, 4),          // menace 0.5
      t('fort', 12, 3),           // menace 4
      t('critique', 1, 4, true),  // critique (menace 0.25 mais priorisé)
      t('moyen', 6, 3),           // menace 2
    ]
    const top = rankEcosystemTiers(parties, 3)
    expect(top.map(p => p.id)).toEqual(['critique', 'fort', 'moyen']) // critique d'abord, puis menace desc
    expect(top).toHaveLength(3) // plafonné
  })

  it('renvoie tout si max ≥ nombre de tiers', () => {
    expect(rankEcosystemTiers([t('a', 1, 1)], 40)).toHaveLength(1)
  })
})
