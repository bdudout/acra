import { describe, expect, it } from 'vitest'
import { cotations, bornesCotation, cascadeCotation, alertesCotation, violationsCotation } from '@/lib/cotation-risque'

const r = { gravite: 4, vraisemblance: 3, graviteActuelle: 4, vraisemblanceActuelle: 2, graviteResiduelle: 3, vraisemblanceResiduelle: 2, strategie: 'REDUIRE', mesuresCount: 0, plansCount: 0 }

describe('cotations brut → actuel → résiduel', () => {
  it('valeurs effectives : actuel ← brut, résiduel ← actuel quand absents', () => {
    expect(cotations({ gravite: 3, vraisemblance: 2 })).toEqual({ brut: { g: 3, v: 2 }, actuel: { g: 3, v: 2 }, residuel: { g: 3, v: 2 } })
    expect(cotations(r)).toEqual({ brut: { g: 4, v: 3 }, actuel: { g: 4, v: 2 }, residuel: { g: 3, v: 2 } })
  })
  it('bornes : l’actuel ne dépasse pas le brut, le résiduel ne dépasse pas l’actuel', () => {
    expect(bornesCotation(r)).toEqual({ brut: { g: 5, v: 5 }, actuel: { g: 4, v: 3 }, residuel: { g: 4, v: 2 } })
  })
})

describe('cascade : une baisse se propage aux niveaux suivants', () => {
  it('baisser le brut ramène l’actuel et le résiduel sous la nouvelle borne', () => {
    expect(cascadeCotation(r, { vraisemblance: 1 })).toEqual({ vraisemblance: 1, vraisemblanceActuelle: 1, vraisemblanceResiduelle: 1 })
    expect(cascadeCotation(r, { gravite: 2 })).toEqual({ gravite: 2, graviteActuelle: 2, graviteResiduelle: 2 })
  })
  it('baisser l’actuel ramène le résiduel ; une hausse au-delà de la borne est plafonnée', () => {
    expect(cascadeCotation(r, { graviteActuelle: 2 })).toEqual({ graviteActuelle: 2, graviteResiduelle: 2 })
    expect(cascadeCotation(r, { vraisemblanceResiduelle: 4 })).toEqual({ vraisemblanceResiduelle: 2 })
  })
  it('sans effet sur les autres champs', () => {
    expect(cascadeCotation(r, { strategie: 'ACCEPTER' } as never)).toEqual({ strategie: 'ACCEPTER' })
  })
})

describe('contrôles', () => {
  it('violations (données anciennes ou appel direct) : actuel > brut, résiduel > actuel', () => {
    expect(violationsCotation({ ...r, graviteActuelle: 4, vraisemblanceActuelle: 4 })).toEqual(['ACTUEL_SUP_BRUT'])
    expect(violationsCotation({ ...r, graviteResiduelle: 4, vraisemblanceResiduelle: 3 })).toEqual(['RESIDUEL_SUP_ACTUEL'])
    expect(violationsCotation(r)).toEqual([])
  })
  it('alertes de cohérence du traitement', () => {
    expect(alertesCotation(r, { decision: 'treat' })).toEqual(['REDUIRE_SANS_MESURE'])
    expect(alertesCotation({ ...r, mesuresCount: 1, graviteResiduelle: 4, vraisemblanceResiduelle: 2 }, { decision: 'treat' })).toEqual(['RESIDUEL_NON_REDUIT'])
    expect(alertesCotation({ ...r, strategie: 'ACCEPTER' }, { decision: 'treat' })).toEqual(['ACCEPTE_HORS_APPETIT'])
    expect(alertesCotation({ ...r, strategie: 'ACCEPTER' }, { decision: 'accept' })).toEqual([])
  })
})
