import { describe, expect, it } from 'vitest'
import { syntheseProjet } from '@/lib/projet-synthese'
import { resolveScaleConfig } from '@/lib/risk-scale'
import { APPETIT_DEFAULT } from '@/lib/appetit'

const ctx = { scale: resolveScaleConfig(null), appetit: APPETIT_DEFAULT }
const r = (id: string, g: number, v: number, o: Record<string, number | null> = {}) => ({ id, nom: id, gravite: g, vraisemblance: v, niveauRisque: g * v, ...o })

describe('synthèse d’un projet 360', () => {
  it('répartition par palier de l’échelle aux trois étapes (brut, actuel, résiduel), dans l’ordre des paliers', () => {
    const s = syntheseProjet([
      r('a', 4, 4, { graviteActuelle: 4, vraisemblanceActuelle: 2, graviteResiduelle: 2, vraisemblanceResiduelle: 2 }),
      r('b', 3, 3),
      r('c', 1, 2),
    ], ctx)
    expect(s.paliers.map(p => p.label)).toEqual(['Faible', 'Modéré', 'Élevé', 'Critique'])
    const parLabel = Object.fromEntries(s.paliers.map(p => [p.label, [p.brut, p.actuel, p.residuel]]))
    expect(parLabel).toEqual({ Faible: [1, 1, 1], Modéré: [0, 0, 1], Élevé: [1, 2, 1], Critique: [1, 0, 0] })
    expect(s.total).toBe(3)
  })
  it('décisions et principaux risques (niveau actuel décroissant, 5 au plus)', () => {
    const s = syntheseProjet([r('a', 4, 4), r('b', 1, 1), r('c', 3, 3), r('d', 2, 2), r('e', 4, 3), r('f', 2, 3)], ctx)
    expect(s.aTraiter + s.acceptables).toBe(6)
    expect(s.principaux.map(x => x.id)).toEqual(['a', 'e', 'c', 'f', 'd'])
  })
  it('projet sans risque : tout à zéro', () => {
    const s = syntheseProjet([], ctx)
    expect(s).toMatchObject({ total: 0, aTraiter: 0, acceptables: 0, principaux: [] })
  })
})
