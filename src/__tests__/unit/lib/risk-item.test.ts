import { describe, it, expect } from 'vitest'
import {
  validateRiskItemInput, cleanRiskItem, niveauRisque, RISK_STATUTS, RISK_PROVENANCES,
} from '@/lib/risk-item'

describe('validateRiskItemInput', () => {
  it('intitulé requis', () => {
    expect(validateRiskItemInput({ intitule: '  ' })).toBe('intitule_requis')
    expect(validateRiskItemInput({ intitule: 'Fraude au virement' })).toBeNull()
  })
  it('cotation 1-5 ou null', () => {
    expect(validateRiskItemInput({ intitule: 'X', graviteInherente: 6 })).toBe('cotation_invalide')
    expect(validateRiskItemInput({ intitule: 'X', vraisemblanceResiduelle: 0 })).toBe('cotation_invalide')
    expect(validateRiskItemInput({ intitule: 'X', graviteInherente: 4, vraisemblanceInherente: 3 })).toBeNull()
    expect(validateRiskItemInput({ intitule: 'X', graviteInherente: null })).toBeNull()
  })
})

describe('cleanRiskItem', () => {
  it('normalise, clampe les cotes, valide statut/provenance', () => {
    const c = cleanRiskItem({
      intitule: '  Risque X  ', graviteInherente: 9, vraisemblanceInherente: 0,
      statut: 'BIDON', provenance: 'ACRA', processusId: ' p1 ', entite: '  ',
    })
    expect(c.intitule).toBe('Risque X')
    expect(c.graviteInherente).toBe(5)          // 9 → clampé
    expect(c.vraisemblanceInherente).toBe(1)     // 0 → clampé
    expect(c.statut).toBe('IDENTIFIE')           // inconnu → défaut
    expect(c.provenance).toBe('ACRA')            // valide → conservé
    expect(c.processusId).toBe('p1')
    expect(c.entite).toBeNull()                  // vide après trim
  })
  it('statut/provenance valides conservés', () => {
    expect(cleanRiskItem({ intitule: 'X', statut: 'TRAITE' }).statut).toBe('TRAITE')
    expect(RISK_STATUTS).toContain('CLOTURE')
    expect(RISK_PROVENANCES).toContain('INCIDENT')
  })
})

describe('niveauRisque', () => {
  it('produit gravité × vraisemblance, null si incomplet', () => {
    expect(niveauRisque(4, 3)).toBe(12)
    expect(niveauRisque(5, 5)).toBe(25)
    expect(niveauRisque(null, 3)).toBeNull()
    expect(niveauRisque(3, null)).toBeNull()
  })
})
