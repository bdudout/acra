import { describe, it, expect } from 'vitest'
import {
  buildSegments, pointX, subCount, monthsPerSub, minYearOf,
} from '@/lib/conformite-trend-axis'

const NOW = new Date(2026, 4, 15) // 15 mai 2026 (mois index 4)

describe('conformite-trend-axis', () => {
  it('granularités : nombre de sous-périodes', () => {
    expect(subCount('month')).toBe(12)
    expect(subCount('quarter')).toBe(4)
    expect(subCount('semester')).toBe(2)
    expect(monthsPerSub('quarter')).toBe(3)
  })

  it('années passées repliées + année en cours dépliée par mois (jusqu\'au mois courant)', () => {
    const segs = buildSegments(NOW, 2024, new Set(), 'month')
    // 2024 et 2025 repliées (1 segment chacune), puis mois de 2026 jusqu'à mai (index 0..4 = 5 mois)
    const collapsed = segs.filter(s => s.subIndex === null)
    expect(collapsed.map(s => s.year)).toEqual([2024, 2025])
    const cur = segs.filter(s => s.year === 2026)
    expect(cur).toHaveLength(5) // janv..mai
    expect(cur[0].subIndex).toBe(0)
    expect(cur[4].subIndex).toBe(4)
  })

  it('déplier une année passée la remplace par ses sous-périodes', () => {
    const segs = buildSegments(NOW, 2024, new Set([2024]), 'month')
    const y2024 = segs.filter(s => s.year === 2024)
    expect(y2024).toHaveLength(12) // année entière dépliée
    expect(y2024.every(s => s.subIndex !== null)).toBe(true)
    // 2025 reste repliée
    expect(segs.filter(s => s.year === 2025 && s.subIndex === null)).toHaveLength(1)
  })

  it('granularité trimestre : année en cours jusqu\'au trimestre courant', () => {
    const segs = buildSegments(NOW, 2026, new Set(), 'quarter')
    // mai (index 4) → trimestre index floor(4/3)=1 → T1, T2 (2 segments)
    expect(segs).toHaveLength(2)
    expect(segs.map(s => s.subIndex)).toEqual([0, 1])
  })

  it('pointX croît avec la date et reste dans [0,1]', () => {
    const segs = buildSegments(NOW, 2024, new Set(), 'month')
    const a = pointX(new Date(2024, 5, 1).getTime(), segs)
    const b = pointX(new Date(2025, 5, 1).getTime(), segs)
    const c = pointX(new Date(2026, 4, 10).getTime(), segs)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(c).toBeLessThanOrEqual(1)
    expect(a).toBeLessThan(b)
    expect(b).toBeLessThan(c)
  })

  it('minYearOf déduit l\'année la plus ancienne', () => {
    expect(minYearOf([new Date(2023, 0, 1).getTime(), new Date(2026, 0, 1).getTime()], NOW)).toBe(2023)
    expect(minYearOf([], NOW)).toBe(2026)
  })
})
