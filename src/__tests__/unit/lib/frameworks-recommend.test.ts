import { describe, it, expect } from 'vitest'
import { recommendedFrameworksForSector, FRAMEWORK_IDS } from '@/lib/frameworks-data'

// Suggestion automatique du référentiel selon le secteur (improvements-priority.md 🔴).

describe('recommendedFrameworksForSector', () => {
  it('Banque / Finance → DORA en priorité, puis PCI-DSS', () => {
    const r = recommendedFrameworksForSector('Banque / Finance')
    expect(r[0]).toBe('DORA')
    expect(r).toContain('PCI_DSS')
  })

  it('Santé / Médico-social → HDS en priorité', () => {
    expect(recommendedFrameworksForSector('Santé / Médico-social')[0]).toBe('HDS')
  })

  it('Défense → NIST 800-53 + ANSSI', () => {
    const r = recommendedFrameworksForSector('Défense / Sécurité nationale')
    expect(r).toContain('NIST_800_53')
    expect(r).toContain('ANSSI_HYG')
  })

  it('Commerce / Distribution → PCI-DSS', () => {
    expect(recommendedFrameworksForSector('Commerce / Distribution')).toContain('PCI_DSS')
  })

  it('insensible à la casse et aux variantes (mots-clés)', () => {
    expect(recommendedFrameworksForSector('banque de détail')[0]).toBe('DORA')
    expect(recommendedFrameworksForSector('Healthcare')[0]).toBe('HDS')
  })

  it('secteur inconnu / vide → repli ISO 27001', () => {
    expect(recommendedFrameworksForSector('')).toEqual(['ISO27001'])
    expect(recommendedFrameworksForSector(null)).toEqual(['ISO27001'])
    expect(recommendedFrameworksForSector('Secteur exotique')).toEqual(['ISO27001'])
  })

  it('ne recommande que des ids de framework valides (jamais CUSTOM)', () => {
    for (const sec of ['Banque / Finance', 'Santé / Médico-social', 'Énergie / Utilities', 'Autre']) {
      for (const fid of recommendedFrameworksForSector(sec)) {
        expect(FRAMEWORK_IDS).toContain(fid)
        expect(fid).not.toBe('CUSTOM')
      }
    }
  })
})
