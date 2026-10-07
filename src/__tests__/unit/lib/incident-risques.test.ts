import { describe, expect, it } from 'vitest'
import { normaliserRisqueIds, risquesDepuisCorps, incidentsParRisque, MAX_RISQUES_PAR_INCIDENT } from '@/lib/incident-risques'
import { suggestCalibration } from '@/lib/incident'

describe('association d’un incident à plusieurs risques du registre', () => {
  it('liste normalisée : chaînes non vides, sans doublon, ordre conservé (le premier = risque principal), plafonnée', () => {
    expect(normaliserRisqueIds(['r2', '', 'r1', 'r2', 3, null])).toEqual(['r2', 'r1'])
    expect(normaliserRisqueIds('r1')).toEqual([])
    expect(normaliserRisqueIds(Array.from({ length: 50 }, (_, i) => `r${i}`))).toHaveLength(MAX_RISQUES_PAR_INCIDENT)
  })
  it('lecture du corps : liste prioritaire ; ancien champ unique accepté ; absent = pas de changement', () => {
    expect(risquesDepuisCorps({ riskItemIds: ['a', 'b'] })).toEqual(['a', 'b'])
    expect(risquesDepuisCorps({ riskItemId: 'a' })).toEqual(['a'])
    expect(risquesDepuisCorps({ riskItemId: null })).toEqual([])
    expect(risquesDepuisCorps({ intitule: 'x' })).toBeNull()
  })
  it('calibrage : un incident lié à deux risques compte pour chacun', () => {
    const lite = incidentsParRisque([{ riskItemIds: ['a', 'b'], dateSurvenance: '2026-09-01', montantBrut: 1000, recuperations: 0 }, { riskItemIds: ['a'], dateSurvenance: '2026-08-01', montantBrut: 500, recuperations: 100 }])
    expect(suggestCalibration(lite, 'a').occurrences).toBe(2)
    expect(suggestCalibration(lite, 'b')).toMatchObject({ occurrences: 1, perteNetteTotale: 1000 })
  })
})
