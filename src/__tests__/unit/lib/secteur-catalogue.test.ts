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

// Pack postal, lot L2 : le secteur postal est inséré juste avant « Autre », au même index dans les 5 langues
// (canonique() en dépend), avec l'intitulé officiel de l'annexe II de NIS2 dans chaque langue.
describe('secteur postal — même index dans les 5 langues', () => {
  it('avant « Autre », intitulé officiel', () => {
    const n = SECTEURS_ACTIVITE.length
    expect(SECTEURS_ACTIVITE[n - 1]).toBe('Autre')
    const attendus = {'fr': 'Services postaux et d’expédition', 'en': 'Postal and courier services', 'de': 'Post- und Kurierdienste', 'es': 'Servicios postales y de mensajería', 'it': 'Servizi postali e di corriere'}
    for (const [l, lib] of Object.entries(attendus)) {
      const liste = getEbiosData(l as 'fr').SECTEURS_ACTIVITE as readonly string[]
      expect(liste, l).toHaveLength(n)
      expect(liste[n - 2], l).toBe(lib)
    }
  })
})

