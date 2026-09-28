import { describe, expect, it } from 'vitest'
import { suggestedQualificationRisks } from '@/lib/qualification'

describe('suggestedQualificationRisks', () => {
  it('propose le risque cyber correspondant avec ses cotations configurées', () => {
    expect(suggestedQualificationRisks({ donneesPersonnelles: true }, [{ id: 'data', when: { questionId: 'donneesPersonnelles', equals: true }, risk: { category: 'CYBER', title: 'Divulgation de données', gravity: 4, likelihood: 2, strategy: 'REDUIRE' } }])).toEqual([expect.objectContaining({ id: 'data', title: 'Divulgation de données', gravity: 4, likelihood: 2 })])
  })

  it('respecte le périmètre de méthodologie configuré pour une règle', () => {
    const rules = [{ id: 'iso-only', methods: ['ISO_27005'] as const, when: { questionId: 'donneesPersonnelles', equals: true }, risk: { category: 'CYBER' as const, title: 'Risque ISO', gravity: 3, likelihood: 2, strategy: 'REDUIRE' as const } }]
    expect(suggestedQualificationRisks({ donneesPersonnelles: true }, rules, 'EBIOS_RM')).toEqual([])
    expect(suggestedQualificationRisks({ donneesPersonnelles: true }, rules, 'ISO_27005')).toHaveLength(1)
  })
})
