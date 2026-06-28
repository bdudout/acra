import { describe, it, expect } from 'vitest'
import { PRIORITES_MESURE, prioriteRank, comparePriorite, measureAppliesTo, measureScenarioCount, measuresApplyingTo } from '@/lib/ecosystem-measures'

// Enrichissement des mesures écosystème — priorités P1→P4 (GitHub issue #2).

describe('priorités des mesures écosystème', () => {
  it('expose P1→P4 dans l’ordre', () => {
    expect(PRIORITES_MESURE).toEqual(['P1', 'P2', 'P3', 'P4'])
  })
  it('rang croissant P1 < P2 < P3 < P4', () => {
    expect(prioriteRank('P1')).toBeLessThan(prioriteRank('P2'))
    expect(prioriteRank('P3')).toBeLessThan(prioriteRank('P4'))
  })
  it('priorité absente/inconnue passe en dernier', () => {
    expect(prioriteRank(undefined)).toBeGreaterThan(prioriteRank('P4'))
    expect(prioriteRank('P9')).toBeGreaterThan(prioriteRank('P4'))
  })
  it('comparePriorite trie P1 d’abord, inconnus en fin', () => {
    const arr = [{ priorite: 'P3' }, { priorite: 'P1' }, { priorite: undefined }, { priorite: 'P2' }]
    const sorted = [...arr].sort(comparePriorite).map(m => m.priorite)
    expect(sorted).toEqual(['P1', 'P2', 'P3', undefined])
  })
})

describe('mutualisation des mesures entre scénarios', () => {
  const scenarios = [
    { id: 's1', nom: 'Scénario 1', mesuresEcosysteme: [
      { id: 'm1', mesure: 'MFA', scenarioIds: ['s2'] },   // mutualisée s1 + s2
      { id: 'm2', mesure: 'Audit prestataire' },           // propre à s1
    ] },
    { id: 's2', nom: 'Scénario 2', mesuresEcosysteme: [
      { id: 'm3', mesure: 'Clause contractuelle' },        // propre à s2
    ] },
  ]

  it('measureAppliesTo : propriétaire et scénarios additionnels', () => {
    expect(measureAppliesTo({ id: 'm1', scenarioIds: ['s2'] }, 's1', 's1')).toBe(true)  // propriétaire
    expect(measureAppliesTo({ id: 'm1', scenarioIds: ['s2'] }, 's1', 's2')).toBe(true)  // additionnel
    expect(measureAppliesTo({ id: 'm2' }, 's1', 's2')).toBe(false)
  })

  it('measureScenarioCount : propriétaire inclus, sans doublon', () => {
    expect(measureScenarioCount({ scenarioIds: ['s2'] }, 's1')).toBe(2)
    expect(measureScenarioCount({ scenarioIds: ['s1'] }, 's1')).toBe(1) // s1 dédupliqué
    expect(measureScenarioCount({}, 's1')).toBe(1)
  })

  it('measuresApplyingTo : agrège propriétaire + mutualisées, marque _mutualisee', () => {
    const s1 = measuresApplyingTo(scenarios, 's1').map(m => m.id)
    expect(s1).toEqual(['m1', 'm2'])
    const s2 = measuresApplyingTo(scenarios, 's2')
    expect(s2.map(m => m.id)).toEqual(['m1', 'm3']) // m1 mutualisée remonte sous s2
    const m1 = s2.find(m => m.id === 'm1')!
    expect(m1._mutualisee).toBe(true)
    expect(m1._ownerId).toBe('s1')
    expect(s2.find(m => m.id === 'm3')!._mutualisee).toBe(false)
  })

  it('measuresApplyingTo : déduplique par id de mesure', () => {
    const dup = [
      { id: 'sa', nom: 'A', mesuresEcosysteme: [{ id: 'mx', scenarioIds: ['sa'] }] },
    ]
    expect(measuresApplyingTo(dup, 'sa').filter(m => m.id === 'mx')).toHaveLength(1)
  })
})
