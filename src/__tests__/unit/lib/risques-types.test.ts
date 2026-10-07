import { describe, expect, it } from 'vitest'
import { catalogueRisquesTypes, selectionRisquesTypes } from '@/lib/risque-exemples'

const ctx = {
  secteur: 'Santé / Médico-social', sousSecteur: ['sante-clinique'], patterns: ['CLOUD_IAAS_PAAS'], locale: 'fr' as const,
  base: [{ intitule: 'Erreur humaine de manipulation', gravite: 2, vraisemblance: 3 }],
  registre: [{ intitule: 'Fraude interne', gravite: 3, vraisemblance: 2, domaine: 'FRAUD' }],
  existants: ['FRAUDE INTERNE'],
}

describe('catalogueRisquesTypes — risques types d’un projet, par origine', () => {
  const cat = catalogueRisquesTypes(ctx)
  const groupes = (g: string) => cat.filter(r => r.groupe === g)

  it('registre de l’organisation en tête, déjà présent signalé', () => {
    expect(cat[0]).toMatchObject({ groupe: 'REGISTRE', intitule: 'Fraude interne', domaine: 'FRAUD', present: true })
  })
  it('secteur, sous-secteur et architecture : tous les risques, sans plafond, domaine cyber', () => {
    expect(groupes('SECTEUR').length).toBeGreaterThan(0)
    expect(groupes('SOUS_SECTEUR').length).toBeGreaterThan(0)
    expect(groupes('ARCHITECTURE').length).toBeGreaterThan(0)
    expect(cat.length).toBeGreaterThan(12)
    expect(groupes('SECTEUR').every(r => !r.present)).toBe(true)
  })
  it('socle transverse en dernier ; aucun intitulé en double', () => {
    expect(cat[cat.length - 1]).toMatchObject({ groupe: 'TRANSVERSE', intitule: 'Erreur humaine de manipulation', gravite: 2, vraisemblance: 3, domaine: 'CYBER' })
    const cles = cat.map(r => r.intitule.toLowerCase())
    expect(new Set(cles).size).toBe(cles.length)
  })
  it('sans secteur ni pattern : registre et socle transverse seulement', () => {
    const vide = catalogueRisquesTypes({ ...ctx, secteur: null, sousSecteur: [], patterns: [] })
    expect([...new Set(vide.map(r => r.groupe))]).toEqual(['REGISTRE', 'TRANSVERSE'])
  })
  it('risques du catalogue sectoriel GRC : description reprise, domaine déduit, cotation G2·V2 à revoir', () => {
    expect(groupes('SECTEUR').length).toBeGreaterThan(10)
    expect(cat.find(r => r.description)).toMatchObject({ gravite: 2, vraisemblance: 2 })
    expect(cat.some(r => r.groupe === 'TRANSVERSE' && r.domaine === 'FRAUD')).toBe(true)
  })
})

describe('selectionRisquesTypes — ce que l’import crée réellement', () => {
  it('seuls des risques du catalogue, pas déjà présents, sans doublon', () => {
    const cat = catalogueRisquesTypes(ctx)
    const sel = selectionRisquesTypes(cat, ['erreur humaine de manipulation', 'Fraude interne', 'Inventé', 'Erreur humaine de manipulation'])
    expect(sel.map(r => r.intitule)).toEqual(['Erreur humaine de manipulation'])
  })
})
