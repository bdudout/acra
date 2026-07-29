import { describe, it, expect } from 'vitest'
import { emailLocale, derogationExpiryEmail, derogationDigestEmail } from '@/lib/email-i18n'

describe('emailLocale', () => {
  it('normalise vers une locale supportée, repli fr', () => {
    expect(emailLocale('en')).toBe('en')
    expect(emailLocale('it')).toBe('it')
    expect(emailLocale('xx')).toBe('fr')
    expect(emailLocale(null)).toBe('fr')
    expect(emailLocale(undefined)).toBe('fr')
  })
})

describe('derogationExpiryEmail', () => {
  it('français : expire dans / expirée depuis', () => {
    const a = derogationExpiryEmail('fr', { intitule: 'Accès legacy', jours: 10 })
    expect(a.subject).toContain('Accès legacy')
    expect(a.text).toContain('expire dans 10 j')
    const b = derogationExpiryEmail('fr', { intitule: 'X', jours: -3 })
    expect(b.text).toContain('expirée depuis 3 j')
  })
  it('anglais : sujet et corps traduits', () => {
    const e = derogationExpiryEmail('en', { intitule: 'Legacy access', jours: 5 })
    expect(e.subject).toContain('Waiver')
    expect(e.text).toContain('expires in 5 day(s)')
    expect(e.text).toContain('ACRA')
  })
  it('locale inconnue → repli français', () => {
    expect(derogationExpiryEmail('zz', { intitule: 'X', jours: 2 }).text).toContain('expire dans 2 j')
  })
  it('allemand / espagnol / italien', () => {
    expect(derogationExpiryEmail('de', { intitule: 'X', jours: 4 }).text).toContain('läuft in 4')
    expect(derogationExpiryEmail('es', { intitule: 'X', jours: 4 }).text).toContain('caduca en 4')
    expect(derogationExpiryEmail('it', { intitule: 'X', jours: 4 }).text).toContain('scade tra 4')
  })
})

describe('derogationDigestEmail', () => {
  const params = { orgNom: 'StarBank', active: 3, expireBientot: 2, expiree: 1, items: [
    { intitule: 'Deux', joursRestants: 5 },
    { intitule: 'Un', joursRestants: -2 },
  ] }
  it('anglais : compteurs et lignes localisés', () => {
    const e = derogationDigestEmail('en', params)
    expect(e.subject).toContain('Waivers summary')
    expect(e.subject).toContain('StarBank')
    expect(e.text).toContain('Active : 3')
    expect(e.text).toContain('Expiring soon : 2')
    expect(e.text).toContain('Expired : 1')
    expect(e.text).toContain('expires in 5 day(s)')
    expect(e.text).toContain('expired 2 day(s) ago')
  })
  it('français par défaut', () => {
    const e = derogationDigestEmail(null, params)
    expect(e.text).toContain('Actives : 3')
    expect(e.text).toContain('Bientôt expirées : 2')
  })
})
