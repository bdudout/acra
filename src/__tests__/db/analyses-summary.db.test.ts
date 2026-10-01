/** Indicateurs de la liste des analyses (T13) : agrégats SQL = calcul naïf sur les lignes. */
import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { withRiskSummary } from '@/lib/analyses-summary.server'
import { getRiskTier } from '@/lib/risk-scale'
import { makeOrg, makeUser } from './helpers'

afterAll(async () => { await prisma.$disconnect() })

describe('withRiskSummary (T13)', () => {
  it('max, critiques, à réduire et mesures P1 à faire identiques au calcul sur les lignes', async () => {
    const org = await makeOrg()
    const u = await makeUser('ANALYSTE', [org])
    const a1 = await prisma.analyse.create({ data: { userId: u.id, nom: 'a1', organizationId: org.id } })
    const a2 = await prisma.analyse.create({ data: { userId: u.id, nom: 'a2 (vide)', organizationId: org.id } })
    const levels: [number, number, 'REDUIRE' | 'ACCEPTER'][] = [[4, 4, 'REDUIRE'], [3, 4, 'ACCEPTER'], [2, 2, 'REDUIRE'], [4, 3, 'REDUIRE']]
    for (const [g, v, strategie] of levels) {
      await prisma.risque.create({ data: { analyseId: a1.id, nom: `r${g}${v}`, gravite: g, vraisemblance: v, niveauRisque: g * v, strategie } })
    }
    await prisma.mesure.createMany({ data: [
      { analyseId: a1.id, nom: 'm1', priorite: 1, statut: 'A_FAIRE' },
      { analyseId: a1.id, nom: 'm2', priorite: 1, statut: 'REALISE' },
      { analyseId: a1.id, nom: 'm3', priorite: 2, statut: 'A_FAIRE' },
    ] })
    const [s1, s2] = await withRiskSummary([{ id: a1.id }, { id: a2.id }])
    const risques = await prisma.risque.findMany({ where: { analyseId: a1.id } })
    expect(s1.riskSummary).toEqual({
      maxRisk: Math.max(...risques.map(r => r.niveauRisque)),
      critiques: risques.filter(r => getRiskTier(r.niveauRisque) === 'critique').length,
      reduire: risques.filter(r => r.strategie === 'REDUIRE').length,
      p1AFaire: 1,
    })
    expect(s1.riskSummary).toEqual({ maxRisk: 16, critiques: 3, reduire: 3, p1AFaire: 1 })
    expect(s2.riskSummary).toEqual({ maxRisk: 0, critiques: 0, reduire: 0, p1AFaire: 0 })
  })
})
