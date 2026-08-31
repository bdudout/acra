import { describe, it, expect } from 'vitest'
import { heatCellColor } from '@/lib/pdf-heatmap'

describe('heatCellColor (#134 — couleur RAG d\'une cellule de heatmap)', () => {
  it('mappe chaque palier vers sa couleur, vide pour l\'inconnu', () => {
    expect(heatCellColor('eleve')).toBe('#DC2626')
    expect(heatCellColor('moyen')).toBe('#D97706')
    expect(heatCellColor('faible')).toBe('#16A34A')
    expect(heatCellColor(undefined)).toBe('#F3F4F6')
    expect(heatCellColor('autre')).toBe('#F3F4F6')
  })
})
