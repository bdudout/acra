import { describe, expect, it } from 'vitest'
import { codesCatalogueSecteur } from '@/lib/secteur-catalogue'
import { SECTEURS_ACTIVITE } from '@/lib/ebios-data'
import { getEbiosData } from '@/lib/ebios-data-i18n'

describe('codesCatalogueSecteur — secteur d’une analyse → secteurs du catalogue GRC', () => {
  it('libellé français ou traduit', () => {
    expect(codesCatalogueSecteur('Santé / Médico-social')).toEqual(['SANTE'])
    const en = getEbiosData('en').SECTEURS_ACTIVITE as string[]
    expect(codesCatalogueSecteur(en[SECTEURS_ACTIVITE.indexOf('Santé / Médico-social')])).toEqual(['SANTE'])
  })
  it('assurance ajoutée par un sous-secteur assurance / complémentaire santé', () => {
    expect(codesCatalogueSecteur('Banque / Finance')).toEqual(['FINANCE'])
    expect(codesCatalogueSecteur('Banque / Finance', ['banque-assurance'])).toEqual(['FINANCE', 'ASSURANCE'])
    expect(codesCatalogueSecteur('Santé / Médico-social', ['sante-amc'])).toEqual(['SANTE', 'ASSURANCE'])
  })
  it('tous les secteurs sauf « Autre » ont une correspondance ; inconnu ou vide → aucune', () => {
    for (const s of SECTEURS_ACTIVITE) if (s !== 'Autre') expect(codesCatalogueSecteur(s).length, s).toBeGreaterThan(0)
    expect(codesCatalogueSecteur('Autre')).toEqual([])
    expect(codesCatalogueSecteur('Inconnu')).toEqual([])
    expect(codesCatalogueSecteur(null)).toEqual([])
  })
})
