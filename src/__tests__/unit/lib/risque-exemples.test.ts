// Suggestions de risques sectoriels (saisie directe) — module pur.
import { describe, it, expect } from 'vitest'
import { suggestRisqueExemples } from '@/lib/risque-exemples'

describe('suggestRisqueExemples', () => {
  it('secteur inconnu ou vide → aucune suggestion', () => {
    expect(suggestRisqueExemples({ secteur: null })).toEqual([])
    expect(suggestRisqueExemples({ secteur: 'licorne-arc-en-ciel' })).toEqual([])
  })

  it('secteur santé → suggestions avec intitulé + G/V dans l’échelle 1..4', () => {
    const s = suggestRisqueExemples({ secteur: 'Santé' })
    expect(s.length).toBeGreaterThan(0)
    for (const e of s) {
      expect(typeof e.intitule).toBe('string')
      expect(e.intitule.trim().length).toBeGreaterThan(0)
      expect(e.gravite).toBeGreaterThanOrEqual(1)
      expect(e.gravite).toBeLessThanOrEqual(4)
      expect(e.vraisemblance).toBeGreaterThanOrEqual(1)
      expect(e.vraisemblance).toBeLessThanOrEqual(4)
    }
    // Un scénario stratégique santé connu remonte (SIH / rançongiciel).
    expect(s.some(e => /SIH|rançongiciel|santé/i.test(e.intitule))).toBe(true)
  })

  it('les événements redoutés (sans vraisemblance) prennent la valeur par défaut 2', () => {
    const s = suggestRisqueExemples({ secteur: 'Santé' })
    // « Indisponibilité du SIH… » vient d’un événement redouté → V par défaut = 2, G = 4.
    const evt = s.find(e => /Indisponibilité du SIH/i.test(e.intitule))
    expect(evt).toBeTruthy()
    expect(evt!.vraisemblance).toBe(2)
    expect(evt!.gravite).toBe(4)
  })

  it('déduplique par intitulé et respecte la limite', () => {
    const s = suggestRisqueExemples({ secteur: 'finance', limit: 3 })
    expect(s.length).toBeLessThanOrEqual(3)
    const intitules = s.map(e => e.intitule.toLowerCase().trim())
    expect(new Set(intitules).size).toBe(intitules.length)
  })

  it('un scénario stratégique conserve sa gravité et sa vraisemblance d’origine', () => {
    const s = suggestRisqueExemples({ secteur: 'Santé' })
    // « Arrêt du SIH par rançongiciel (D) » : graviteDefaut 4, vraisemblanceDefaut 3.
    const scen = s.find(e => /Arrêt du SIH par rançongiciel/i.test(e.intitule))
    expect(scen).toBeTruthy()
    expect(scen!.gravite).toBe(4)
    expect(scen!.vraisemblance).toBe(3)
  })
})
