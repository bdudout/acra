import { describe, expect, it } from 'vitest'
import { trierPlansParPriorite } from '@/lib/plans-priorite'

const now = new Date('2026-10-06T00:00:00Z')
const plan = (id: string, o: Partial<{ statut: string; priorite: string; echeance: string | null; niveau: number }>) =>
  ({ id, titre: id, statut: o.statut ?? 'A_FAIRE', priorite: o.priorite ?? 'MAJEUR', echeance: o.echeance ?? null, porteur: null, risques: [{ id: `r-${id}`, nom: `R ${id}`, niveau: o.niveau ?? 4 }] })

describe('plans d’action d’un projet par priorité', () => {
  it('ouverts avant faits ; risque le plus élevé d’abord ; puis priorité du plan ; puis échéance (retard en tête)', () => {
    const r = trierPlansParPriorite([
      plan('fait-critique', { statut: 'FAIT', niveau: 16 }),
      plan('moyen', { niveau: 6 }),
      plan('eleve-majeur', { niveau: 12, priorite: 'MAJEUR' }),
      plan('eleve-critique', { niveau: 12, priorite: 'CRITIQUE' }),
      plan('eleve-critique-retard', { niveau: 12, priorite: 'CRITIQUE', echeance: '2026-09-01' }),
    ], now)
    expect(r.map(p => p.id)).toEqual(['eleve-critique-retard', 'eleve-critique', 'eleve-majeur', 'moyen', 'fait-critique'])
    expect(r[0]).toMatchObject({ enRetard: true, niveauMax: 12 })
    expect(r[4].enRetard).toBe(false) // un plan fait n'est jamais en retard
  })
  it('plan lié à plusieurs risques : le plus élevé compte', () => {
    const p = { ...plan('multi', { niveau: 2 }), risques: [{ id: 'a', nom: 'A', niveau: 2 }, { id: 'b', nom: 'B', niveau: 9 }] }
    expect(trierPlansParPriorite([plan('x', { niveau: 6 }), p], now).map(x => x.id)).toEqual(['multi', 'x'])
  })
})
