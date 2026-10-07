/** La qualification d'une analyse cyber reprend les réponses équivalentes de la qualification 360 de son projet. */
import { describe, expect, it } from 'vitest'
import { qualificationDepuisProjet, completerQualification } from '@/lib/projet360'

describe('qualificationDepuisProjet', () => {
  it('exposition Internet, données personnelles, réglementation, externalisation (prestataire critique ou nuage)', () => {
    expect(qualificationDepuisProjet({
      'p360.cyber.exposeInternet': true, 'p360.cyber.donneesSensibles': false,
      'p360.metier.exigenceReglementaire': true, 'p360.ext.prestataireCritique': false, 'p360.ext.cloud': true,
      'p360.projet.delaiContraint': true, 'p360._sources': { x: 'y' },
    })).toEqual({ expositionInternet: true, donneesPersonnelles: false, reglementation: true, externalisation: true })
  })
  it('externalisation « non » seulement si prestataire critique ET nuage sont « non » ; questions non répondues ignorées', () => {
    expect(qualificationDepuisProjet({ 'p360.ext.prestataireCritique': false, 'p360.ext.cloud': false })).toEqual({ externalisation: false })
    expect(qualificationDepuisProjet({ 'p360.ext.prestataireCritique': false })).toEqual({})
    expect(qualificationDepuisProjet(null)).toEqual({})
  })
})

describe('completerQualification', () => {
  it('ne remplace jamais une réponse déjà saisie ; renvoie les questions reprises', () => {
    const r = completerQualification({ expositionInternet: false, criticite: 'haute' }, { expositionInternet: true, donneesPersonnelles: true })
    expect(r.answers).toEqual({ expositionInternet: false, criticite: 'haute', donneesPersonnelles: true })
    expect(r.reprises).toEqual(['donneesPersonnelles'])
  })
})
