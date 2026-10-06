/** Analyses cyber liées à un projet : risques à traiter (niveau actuel) pas encore importés dans le projet. */
import { describe, expect, it } from 'vitest'
import { cyberLiesNonImportes } from '@/lib/projet-cyber-lies'
import { resolveScaleConfig } from '@/lib/risk-scale'
import { APPETIT_DEFAULT } from '@/lib/appetit'

const ctx = { scale: resolveScaleConfig(null), appetit: APPETIT_DEFAULT }
const r = (id: string, g: number, v: number, o: Record<string, number | null> = {}) => ({ id, nom: id, gravite: g, vraisemblance: v, niveauRisque: g * v, ...o })

describe('cyberLiesNonImportes', () => {
  it('par analyse : risques à traiter non importés (les importés et les acceptables sont écartés), du plus élevé au plus bas', () => {
    const res = cyberLiesNonImportes([
      { id: 'a1', nom: 'Cyber A', risques: [r('x', 4, 4), r('y', 4, 3), r('z', 1, 1), r('w', 4, 4, { graviteActuelle: 1, vraisemblanceActuelle: 1 })] },
      { id: 'a2', nom: 'Cyber B', risques: [r('k', 1, 2)] },
    ], ['y'], ctx)
    expect(res).toEqual([{ id: 'a1', nom: 'Cyber A', aImporter: 1, exemples: ['x'] }, { id: 'a2', nom: 'Cyber B', aImporter: 0, exemples: [] }])
  })
})
