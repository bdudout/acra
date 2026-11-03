// Axe « famille de risque TIC » du registre (lot L2) : distinct de la taxonomie (Bâle ou propre à l'org).
import { describe, it, expect } from 'vitest'
import {
  FAMILLES_RISQUE_TIC, isFamilleRisqueTic, cleanFamilleRisqueTic, familleDepuisDomaine360, familleCatalogue, FAMILLE_CATALOGUE,
} from '@/lib/famille-risque-tic'
import { RISK_BALE } from '@/lib/catalogue-risks'

describe('famille-risque-tic', () => {
  it('liste exactement les 5 familles, dans l’ordre d’affichage', () => {
    expect(FAMILLES_RISQUE_TIC).toEqual(['IT', 'CYBER', 'CONTINUITE_METIER_TIC', 'CONTINUITE_IT', 'TIERS_TIC'])
  })
  it('valide un code de famille', () => {
    expect(isFamilleRisqueTic('CYBER')).toBe(true)
    expect(isFamilleRisqueTic('TIERS_TIC')).toBe(true)
    expect(isFamilleRisqueTic('cyber')).toBe(false)
    expect(isFamilleRisqueTic('BALE_6')).toBe(false)
    expect(isFamilleRisqueTic(null)).toBe(false)
    expect(isFamilleRisqueTic(3)).toBe(false)
  })
  it('normalise : code connu conservé, vide/inconnu → null', () => {
    expect(cleanFamilleRisqueTic('CONTINUITE_IT')).toBe('CONTINUITE_IT')
    expect(cleanFamilleRisqueTic(' IT ')).toBe('IT')
    expect(cleanFamilleRisqueTic('')).toBeNull()
    expect(cleanFamilleRisqueTic(undefined)).toBeNull()
    expect(cleanFamilleRisqueTic('AUTRE')).toBeNull()
  })
  it('déduit la famille du domaine Projet 360 (CYBER, IT, OUTSOURCING ; autres → null)', () => {
    expect(familleDepuisDomaine360('CYBER')).toBe('CYBER')
    expect(familleDepuisDomaine360('IT')).toBe('IT')
    expect(familleDepuisDomaine360('OUTSOURCING')).toBe('TIERS_TIC')
    for (const d of ['PROJECT', 'BUSINESS', 'FRAUD', '', null, undefined, 'X']) expect(familleDepuisDomaine360(d)).toBeNull()
  })
  it('classe les entrées du catalogue concernées (et seulement des risques connus)', () => {
    expect(familleCatalogue('core.risk.ransomware')).toBe('CYBER')
    expect(familleCatalogue('core.risk.it-outage')).toBe('IT')
    expect(familleCatalogue('core.risk.backup-failure')).toBe('CONTINUITE_IT')
    expect(familleCatalogue('core.risk.continuity-plan')).toBe('CONTINUITE_METIER_TIC')
    expect(familleCatalogue('core.risk.supplier-contract')).toBe('TIERS_TIC')
    expect(familleCatalogue('core.risk.internal-fraud')).toBeNull()
    expect(familleCatalogue('inconnu')).toBeNull()
    for (const [key, famille] of Object.entries(FAMILLE_CATALOGUE)) {
      expect(RISK_BALE[key], key).toBeDefined()
      expect(isFamilleRisqueTic(famille)).toBe(true)
    }
    // Chaque famille est représentée au moins une fois dans le catalogue.
    for (const f of FAMILLES_RISQUE_TIC) expect(Object.values(FAMILLE_CATALOGUE)).toContain(f)
  })
})
