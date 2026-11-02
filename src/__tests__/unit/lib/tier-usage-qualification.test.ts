// Qualification d'un usage de service TIC : PCI / non PCI, avec SI / sans SI, exposition Internet / intranet,
// interconnexion par ligne spécialisée (LS) ou via Internet.
import { describe, expect, it } from 'vitest'
import { lireQualificationUsage } from '@/lib/tier-offers'

describe('lireQualificationUsage', () => {
  it('ne retient que les champs présents (mise à jour partielle)', () => {
    expect(lireQualificationUsage({ perimetrePci: true })).toEqual({ ok: true, data: { perimetrePci: true } })
    expect(lireQualificationUsage({})).toEqual({ ok: true, data: {} })
  })
  it('vide ou null = non renseigné', () => {
    expect(lireQualificationUsage({ perimetrePci: '', avecSi: null, interconnexion: '' })).toEqual({ ok: true, data: { perimetrePci: null, avecSi: null, interconnexion: null } })
  })
  it('interconnexion LS ou Internet : l’usage est forcément avec SI', () => {
    expect(lireQualificationUsage({ interconnexion: 'LIGNE_SPECIALISEE' })).toEqual({ ok: true, data: { interconnexion: 'LIGNE_SPECIALISEE', avecSi: true } })
    expect(lireQualificationUsage({ interconnexion: 'INTERNET' })).toEqual({ ok: true, data: { interconnexion: 'INTERNET', avecSi: true } })
  })
  it('sans SI : aucune interconnexion', () => {
    expect(lireQualificationUsage({ avecSi: false })).toEqual({ ok: true, data: { avecSi: false, interconnexion: null } })
  })
  it('incohérence explicite (sans SI + interconnexion) : refusée', () => {
    expect(lireQualificationUsage({ avecSi: false, interconnexion: 'INTERNET' })).toEqual({ ok: false, error: 'interconnexion_sans_si' })
  })
  it('valeurs inconnues : refusées, jamais corrigées en silence', () => {
    expect(lireQualificationUsage({ perimetrePci: 'oui' })).toEqual({ ok: false, error: 'pci_invalide' })
    expect(lireQualificationUsage({ avecSi: 1 })).toEqual({ ok: false, error: 'si_invalide' })
    expect(lireQualificationUsage({ interconnexion: 'VPN' })).toEqual({ ok: false, error: 'interconnexion_invalide' })
  })
})
