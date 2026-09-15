import { describe, it, expect } from 'vitest'
import { globalConformiteTrend } from '@/lib/conformite-trend'

describe('globalConformiteTrend', () => {
  it('agrège « à la date » sur tous les suivis (as-of)', () => {
    const trend = globalConformiteTrend([
      { points: [
        { date: '2026-01-01', conforme: 2, pertinents: 10 }, // suivi A
        { date: '2026-03-01', conforme: 6, pertinents: 10 },
      ] },
      { points: [
        { date: '2026-02-01', conforme: 5, pertinents: 10 }, // suivi B apparaît en février
      ] },
    ])
    // Dates distinctes : jan, fév, mars
    expect(trend.map(p => p.date.slice(0, 7))).toEqual(['2026-01', '2026-02', '2026-03'])
    // Janvier : seul A (2/10) → 20%
    expect(trend[0]).toMatchObject({ conforme: 2, pertinents: 10, taux: 20 })
    // Février : A(2/10) + B(5/10) → 7/20 = 35%
    expect(trend[1]).toMatchObject({ conforme: 7, pertinents: 20, taux: 35 })
    // Mars : A passe à 6/10, B reste 5/10 → 11/20 = 55%
    expect(trend[2]).toMatchObject({ conforme: 11, pertinents: 20, taux: 55 })
  })

  it('au plus un point par jour (le plus récent) — lisibilité de la courbe globale', () => {
    const trend = globalConformiteTrend([
      { points: [
        { date: '2026-01-10T08:00:00Z', conforme: 2, pertinents: 10 },
        { date: '2026-01-10T14:00:00Z', conforme: 4, pertinents: 10 }, // même jour, plus récent
        { date: '2026-01-10T18:00:00Z', conforme: 7, pertinents: 10 }, // même jour, encore plus récent
        { date: '2026-01-12T09:00:00Z', conforme: 8, pertinents: 10 },
      ] },
    ])
    // Deux jours distincts seulement (10 et 12 janvier)
    expect(trend).toHaveLength(2)
    // Le 10/01 conserve la valeur la plus récente (7/10 → 70%)
    expect(trend[0]).toMatchObject({ conforme: 7, pertinents: 10, taux: 70 })
    expect(trend[1]).toMatchObject({ conforme: 8, taux: 80 })
  })

  it('renvoie une série vide sans point', () => {
    expect(globalConformiteTrend([])).toEqual([])
    expect(globalConformiteTrend([{ points: [] }])).toEqual([])
  })

  it('taux = 0 quand aucun contrôle pertinent', () => {
    const trend = globalConformiteTrend([{ points: [{ date: '2026-01-01', conforme: 0, pertinents: 0 }] }])
    expect(trend[0].taux).toBe(0)
  })

  it('accepte les Date comme les chaînes ISO et trie chronologiquement', () => {
    const trend = globalConformiteTrend([{ points: [
      { date: new Date('2026-05-01'), conforme: 3, pertinents: 4 },
      { date: new Date('2026-04-01'), conforme: 1, pertinents: 4 },
    ] }])
    expect(trend.map(p => p.date.slice(0, 7))).toEqual(['2026-04', '2026-05'])
    expect(trend[1].taux).toBe(75)
  })
})
