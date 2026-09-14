import { describe, it, expect } from 'vitest'
import { donutSegments } from '../../../lib/donut'

const C = 100 // circonférence choisie pour lire les longueurs comme des %

describe('donutSegments', () => {
  it('répartit la circonférence proportionnellement et enchaîne les décalages', () => {
    const { total, segments } = donutSegments([
      { key: 'c', value: 6, color: 'green' },
      { key: 'p', value: 2, color: 'amber' },
      { key: 'n', value: 2, color: 'red' },
    ], C)
    expect(total).toBe(10)
    expect(segments.map(s => s.pct)).toEqual([60, 20, 20])
    expect(segments.map(s => Math.round(s.len))).toEqual([60, 20, 20])
    // gap = circonférence - trait
    expect(segments[0].gap).toBeCloseTo(40)
    // décalages cumulés (sens horaire = négatif) : 0, -60, -80
    expect(segments.map(s => Math.round(s.offset))).toEqual([-0, -60, -80])
  })

  it('gère un total nul sans division par zéro', () => {
    const { total, segments } = donutSegments([
      { key: 'c', value: 0, color: 'green' },
      { key: 'n', value: 0, color: 'red' },
    ], C)
    expect(total).toBe(0)
    expect(segments.every(s => s.pct === 0 && s.len === 0)).toBe(true)
    expect(segments.every(s => s.gap === C)).toBe(true)
  })

  it('conserve les parts nulles (légende) avec un trait nul', () => {
    const { segments } = donutSegments([
      { key: 'c', value: 5, color: 'green' },
      { key: 'na', value: 0, color: 'gray' },
    ], C)
    expect(segments).toHaveLength(2)
    expect(segments[1]).toMatchObject({ key: 'na', pct: 0, len: 0 })
  })

  it('ignore les valeurs négatives (traitées comme 0)', () => {
    const { total, segments } = donutSegments([
      { key: 'c', value: 4, color: 'green' },
      { key: 'x', value: -3, color: 'red' },
    ], C)
    expect(total).toBe(4)
    expect(segments[0].pct).toBe(100)
    expect(segments[1].pct).toBe(0)
  })
})
