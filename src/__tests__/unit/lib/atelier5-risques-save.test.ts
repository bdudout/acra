import { describe, it, expect } from 'vitest'
import { planRisquesA5, remapRisqueIdMesure } from '@/lib/atelier5-risques-save'

// Issue #279 : la sauvegarde de l'atelier 5 recréait les risques avec un nouvel id,
// rendant orphelines les mesures (risqueId), dérogations et liens de plan d'action.

let n = 0
const newId = () => `gen${++n}`

describe('planRisquesA5', () => {
  it('conserve l’id d’un risque déjà présent dans l’analyse (mise à jour, pas recréation)', () => {
    const plan = planRisquesA5([{ id: 'r1', nom: 'A' }], { owned: new Set(['r1']), foreign: new Set() }, newId)
    expect(plan.toUpdate).toEqual([{ id: 'r1', data: { nom: 'A' } }])
    expect(plan.toCreate).toEqual([])
    expect(plan.keptIds).toEqual(['r1'])
  })

  it('conserve l’id client d’un nouveau risque (stable entre deux sauvegardes)', () => {
    const plan = planRisquesA5([{ id: 'client-uuid', nom: 'B' }], { owned: new Set(), foreign: new Set() }, newId)
    expect(plan.toCreate).toEqual([{ id: 'client-uuid', nom: 'B' }])
    expect(plan.keptIds).toEqual(['client-uuid'])
  })

  it('régénère un id appartenant à une autre analyse et le remappe', () => {
    n = 0
    const plan = planRisquesA5([{ id: 'autre', nom: 'C' }], { owned: new Set(), foreign: new Set(['autre']) }, newId)
    expect(plan.toCreate).toEqual([{ id: 'gen1', nom: 'C' }])
    expect(plan.idMap.get('autre')).toBe('gen1')
  })

  it('régénère un id absent, invalide ou dupliqué', () => {
    n = 0
    const plan = planRisquesA5(
      [{ nom: 'D' }, { id: 'x y', nom: 'E' }, { id: 'r1', nom: 'F' }, { id: 'r1', nom: 'G' }],
      { owned: new Set(), foreign: new Set() }, newId,
    )
    expect(plan.toCreate.map(r => r.id)).toEqual(['gen1', 'gen2', 'r1', 'gen3'])
  })

  it('retire les champs non persistables (analyseId, dates, libellés UI)', () => {
    const plan = planRisquesA5(
      [{ id: 'r1', nom: 'A', analyseId: 'pirate', analyse: {}, createdAt: 'x', updatedAt: 'y', scenarioOpNom: 'z' }],
      { owned: new Set(['r1']), foreign: new Set() }, newId,
    )
    expect(plan.toUpdate[0].data).toEqual({ nom: 'A' })
  })
})

describe('remapRisqueIdMesure', () => {
  const plan = { idMap: new Map([['autre', 'gen1']]), keptIds: ['r1', 'gen1'] }

  it('garde le lien vers un risque conservé', () => {
    expect(remapRisqueIdMesure('r1', plan)).toBe('r1')
  })
  it('suit un id régénéré', () => {
    expect(remapRisqueIdMesure('autre', plan)).toBe('gen1')
  })
  it('vide un lien vers un risque disparu ou vide', () => {
    expect(remapRisqueIdMesure('supprime', plan)).toBeUndefined()
    expect(remapRisqueIdMesure('', plan)).toBeUndefined()
    expect(remapRisqueIdMesure(null, plan)).toBeUndefined()
  })
})
