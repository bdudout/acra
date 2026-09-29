import { describe, expect, it } from 'vitest'
import { comparerExecutions, prefillRejeu, cleanRattachements, type ExecutionN1 } from '@/lib/controle-l3b'

const ex = (o: Partial<ExecutionN1> & { date: string }): ExecutionN1 => ({ resultat: 'CONFORME', dateRealisation: new Date(o.date), tailleTestee: null, anomaliesTrouvees: null, ...o })

describe('comparaison N vs N-1', () => {
  it('sans deux exécutions comparables : pas de comparaison', () => {
    expect(comparerExecutions([])).toBeNull()
    expect(comparerExecutions([ex({ date: '2026-09-01' })])).toBeNull()
    expect(comparerExecutions([ex({ date: '2026-09-01' }), ex({ date: '2026-06-01', resultat: 'NON_APPLICABLE' })])).toBeNull()
  })
  it('taux d’anomalie sur l’échantillon quand il est renseigné : dégradation / amélioration / stable', () => {
    const d = comparerExecutions([ex({ date: '2026-09-01', resultat: 'ANOMALIE', tailleTestee: 20, anomaliesTrouvees: 4 }), ex({ date: '2026-06-01', resultat: 'ANOMALIE', tailleTestee: 20, anomaliesTrouvees: 1 })])
    expect(d).toMatchObject({ tauxCourant: 20, tauxPrecedent: 5, deltaPts: 15, tendance: 'DEGRADATION' })
    const a = comparerExecutions([ex({ date: '2026-09-01', tailleTestee: 10, anomaliesTrouvees: 0 }), ex({ date: '2026-06-01', resultat: 'ANOMALIE', tailleTestee: 10, anomaliesTrouvees: 3 })])
    expect(a).toMatchObject({ tauxCourant: 0, tauxPrecedent: 30, tendance: 'AMELIORATION' })
    expect(comparerExecutions([ex({ date: '2026-09-01' }), ex({ date: '2026-06-01' })])).toMatchObject({ tendance: 'STABLE', deltaPts: 0 })
  })
  it('sans échantillon : repli sur le résultat (anomalie = 100 %, conforme = 0 %) ; ordre d’entrée indifférent', () => {
    const d = comparerExecutions([ex({ date: '2026-03-01' }), ex({ date: '2026-09-01', resultat: 'ANOMALIE' }), ex({ date: '2026-06-01', resultat: 'NON_APPLICABLE' })])
    expect(d).toMatchObject({ tauxCourant: 100, tauxPrecedent: 0, tendance: 'DEGRADATION', courante: '2026-09-01', precedente: '2026-03-01' })
  })
})

describe('rejeu', () => {
  it('pré-remplit la taille testée de la dernière exécution', () => {
    expect(prefillRejeu([ex({ date: '2026-06-01', tailleTestee: 25 }), ex({ date: '2026-09-01', tailleTestee: 30 })])).toEqual({ tailleTestee: '30' })
    expect(prefillRejeu([])).toEqual({ tailleTestee: '' })
    expect(prefillRejeu([ex({ date: '2026-09-01' })])).toEqual({ tailleTestee: '' })
  })
})

describe('rattachements tiers / projet 360', () => {
  it('ne retient que les clés présentes ; vide ou invalide → null', () => {
    expect(cleanRattachements({})).toEqual({})
    expect(cleanRattachements({ arrangementTicId: 'abc123', projetId: '' })).toEqual({ arrangementTicId: 'abc123', projetId: null })
    expect(cleanRattachements({ arrangementTicId: 42, projetId: 'x'.repeat(100) })).toEqual({ arrangementTicId: null, projetId: null })
    expect(cleanRattachements({ projetId: ' p1 ' })).toEqual({ projetId: 'p1' })
  })
})
