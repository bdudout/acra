// Recette n° 17 : formulaire « Nouvelle analyse » — questions de qualification pré-répondues d'après les patterns
// cochés (SaaS / cloud → externalisation ; exposition Internet → exposé ; SI de TPE → pas de RSSI dédié), sans jamais
// écraser une réponse de l'utilisateur ; bloc « Groupe multi-établissements ? » seulement si l'org a des sous-entités.
import { describe, expect, it } from 'vitest'
import { appliquerQualificationPatterns, aDesSousEntites, qualificationDepuisPatterns } from '@/lib/qualification-patterns'

describe('qualificationDepuisPatterns', () => {
  it('SaaS / cloud → externalisation ; exposition Internet → exposé ; SI de TPE → pas de RSSI dédié', () => {
    expect(qualificationDepuisPatterns(['CLOUD_SAAS', 'EXPOSITION_INTERNET', 'SI_TPE'])).toEqual({ externalisation: true, expositionInternet: true, rssiInterne: false })
    expect(qualificationDepuisPatterns(['CLOUD_IAAS_PAAS'])).toEqual({ externalisation: true })
    expect(qualificationDepuisPatterns(['DMZ'])).toEqual({})
  })
})

describe('appliquerQualificationPatterns', () => {
  it('pré-répond les questions sans réponse ; retire une pré-réponse quand le pattern est décoché', () => {
    const r1 = appliquerQualificationPatterns({ criticite: 'HAUTE' }, {}, ['CLOUD_SAAS', 'SI_TPE'])
    expect(r1.answers).toEqual({ criticite: 'HAUTE', externalisation: true, rssiInterne: false })
    const r2 = appliquerQualificationPatterns(r1.answers, r1.auto, ['SI_TPE'])
    expect(r2.answers).toEqual({ criticite: 'HAUTE', rssiInterne: false })
    expect(r2.auto).toEqual({ rssiInterne: false })
  })
  it('n’écrase jamais une réponse de l’utilisateur (donnée avant, ou modifiée après la pré-réponse)', () => {
    expect(appliquerQualificationPatterns({ externalisation: false }, {}, ['CLOUD_SAAS']).answers).toEqual({ externalisation: false })
    const r1 = appliquerQualificationPatterns({}, {}, ['SI_TPE'])
    const modifie = { ...r1.answers, rssiInterne: true }
    const r2 = appliquerQualificationPatterns(modifie, r1.auto, [])
    expect(r2.answers).toEqual({ rssiInterne: true })
    expect(r2.auto).toEqual({})
  })
})

describe('aDesSousEntites', () => {
  const options = [{ id: 'g', path: '/g/' }, { id: 'f1', path: '/g/f1/' }, { id: 'seule', path: '/seule/' }]
  it('vrai si une organisation accessible est sous l’organisation active', () => {
    expect(aDesSousEntites(options, 'g')).toBe(true)
    expect(aDesSousEntites(options, 'f1')).toBe(false)
    expect(aDesSousEntites(options, 'seule')).toBe(false)
    expect(aDesSousEntites(options, null)).toBe(false)
  })
})
