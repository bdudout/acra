import { describe, it, expect } from 'vitest'
import { mapRisqueToRiskItem, mapAnalyseRisques } from '@/lib/risk-publication'

const analyse = { id: 'an1', nom: 'Analyse SI RH', organisation: 'DRH' }

describe('mapRisqueToRiskItem', () => {
  it('mappe un risque avec résiduel → TRAITE, provenance et traçabilité', () => {
    const item = mapRisqueToRiskItem(
      { id: 'rq1', nom: 'Fuite de données RH', description: 'exfiltration', gravite: 4, vraisemblance: 3, graviteResiduelle: 2, vraisemblanceResiduelle: 1 },
      analyse,
    )
    expect(item).toMatchObject({
      intitule: 'Fuite de données RH', description: 'exfiltration', entite: 'DRH',
      graviteInherente: 4, vraisemblanceInherente: 3, graviteResiduelle: 2, vraisemblanceResiduelle: 1,
      statut: 'TRAITE', provenance: 'ACRA', sourceType: 'analyse', sourceId: 'rq1',
    })
  })
  it('sans résiduel → EVALUE', () => {
    const item = mapRisqueToRiskItem(
      { id: 'rq2', nom: 'DDoS', description: null, gravite: 3, vraisemblance: 4, graviteResiduelle: null, vraisemblanceResiduelle: null },
      analyse,
    )
    expect(item.statut).toBe('EVALUE')
    expect(item.graviteResiduelle).toBeNull()
    expect(item.entite).toBe('DRH')
  })
  it('borne les cotes ACRA (1-4) dans le domaine registre (1-5)', () => {
    const item = mapRisqueToRiskItem(
      { id: 'rq3', nom: 'X', description: null, gravite: 0, vraisemblance: 9, graviteResiduelle: null, vraisemblanceResiduelle: null },
      { id: 'an', nom: 'A', organisation: null },
    )
    expect(item.graviteInherente).toBe(1)
    expect(item.vraisemblanceInherente).toBe(5)
    expect(item.entite).toBeNull()
  })
})

describe('mapAnalyseRisques', () => {
  it('mappe la liste et préserve la traçabilité par risque', () => {
    const items = mapAnalyseRisques(
      [
        { id: 'a', nom: 'A', description: null, gravite: 2, vraisemblance: 2, graviteResiduelle: null, vraisemblanceResiduelle: null },
        { id: 'b', nom: 'B', description: null, gravite: 3, vraisemblance: 3, graviteResiduelle: 1, vraisemblanceResiduelle: 1 },
      ],
      analyse,
    )
    expect(items.map(i => i.sourceId)).toEqual(['a', 'b'])
    expect(items.every(i => i.provenance === 'ACRA' && i.sourceType === 'analyse')).toBe(true)
  })
})
