import { describe, it, expect } from 'vitest'
import {
  SIEM_CATEGORIES,
  categoryForAction,
  categoryForEvent,
  cleanSiemCategories,
  isValidSiemEndpoint,
  shouldForward,
  buildSiemEvent,
  severityForAction,
} from '@/lib/siem'

describe('categoryForAction', () => {
  it('classe les événements d’authentification', () => {
    expect(categoryForAction('LOGIN_SUCCESS')).toBe('AUTHENTIFICATION')
    expect(categoryForAction('LOGIN_FAILED')).toBe('AUTHENTIFICATION')
    expect(categoryForAction('MFA_VERIFIED')).toBe('AUTHENTIFICATION')
    expect(categoryForAction('PASSWORD_CHANGED')).toBe('AUTHENTIFICATION')
  })
  it('classe comptes/accès, configuration, données, gouvernance', () => {
    expect(categoryForAction('USER_CREATED')).toBe('COMPTES')
    expect(categoryForAction('ACCESS_REVOKED')).toBe('COMPTES')
    expect(categoryForAction('SMTP_CONFIG_UPDATED')).toBe('CONFIGURATION')
    expect(categoryForAction('EXPORT')).toBe('DONNEES')
    expect(categoryForAction('DEROGATION_VALIDATED')).toBe('GOUVERNANCE')
  })
  it('chaque catégorie retournée est déclarée dans SIEM_CATEGORIES', () => {
    expect(SIEM_CATEGORIES).toContain(categoryForAction('LOGIN_SUCCESS'))
  })
})

describe('categoryForEvent (catégorie affinée par details.scope)', () => {
  it('reclasse l’action générique ORGANIZATION_CONFIG_UPDATED selon le scope de données', () => {
    // Sans scope → CONFIGURATION (rétrocompatible avec categoryForAction).
    expect(categoryForEvent('ORGANIZATION_CONFIG_UPDATED')).toBe('CONFIGURATION')
    // Scopes « données métier » → DONNEES (upload/suppression de document, seeds, registres…).
    expect(categoryForEvent('ORGANIZATION_CONFIG_UPDATED', { scope: 'document' })).toBe('DONNEES')
    expect(categoryForEvent('ORGANIZATION_CONFIG_UPDATED', { scope: 'audit-mission' })).toBe('DONNEES')
    expect(categoryForEvent('ORGANIZATION_CONFIG_UPDATED', { scope: 'ropa' })).toBe('DONNEES')
    // Scope de configuration/sécurité réelle → reste CONFIGURATION.
    expect(categoryForEvent('ORGANIZATION_CONFIG_UPDATED', { scope: 'branding' })).toBe('CONFIGURATION')
    expect(categoryForEvent('ORGANIZATION_CONFIG_UPDATED', { scope: 'inconnu' })).toBe('CONFIGURATION')
  })
  it('n’affine PAS les actions non génériques (le scope est ignoré)', () => {
    expect(categoryForEvent('LOGIN_FAILED', { scope: 'document' })).toBe('AUTHENTIFICATION')
  })
})

describe('severityForAction', () => {
  it('les échecs/verrouillages d’auth sont warning, le reste info', () => {
    expect(severityForAction('LOGIN_FAILED')).toBe('warning')
    expect(severityForAction('LOGIN_LOCKED')).toBe('warning')
    expect(severityForAction('LOGIN_SUCCESS')).toBe('info')
    expect(severityForAction('USER_DELETED')).toBe('warning')
  })
})

describe('cleanSiemCategories', () => {
  it('ne garde que les catégories connues, dédupliquées', () => {
    expect(cleanSiemCategories(['AUTHENTIFICATION', 'INCONNU', 'DONNEES', 'AUTHENTIFICATION']).sort())
      .toEqual(['AUTHENTIFICATION', 'DONNEES'])
    expect(cleanSiemCategories('nope')).toEqual([])
    expect(cleanSiemCategories(null)).toEqual([])
  })
})

describe('isValidSiemEndpoint', () => {
  it('accepte http(s), rejette le reste', () => {
    expect(isValidSiemEndpoint('https://siem.example.com/ingest')).toBe(true)
    expect(isValidSiemEndpoint('http://localhost:8088/services/collector')).toBe(true)
    expect(isValidSiemEndpoint('ftp://x')).toBe(false)
    expect(isValidSiemEndpoint('pas une url')).toBe(false)
    expect(isValidSiemEndpoint('')).toBe(false)
  })
})

describe('shouldForward', () => {
  const base = { enabled: true, endpoint: 'https://siem/ingest', categories: ['AUTHENTIFICATION'] as string[] }
  it('émet si activé + endpoint + catégorie de l’action activée', () => {
    expect(shouldForward(base, 'LOGIN_FAILED')).toBe(true)
  })
  it('n’émet pas si la catégorie n’est pas activée', () => {
    expect(shouldForward(base, 'EXPORT')).toBe(false)
  })
  it('n’émet pas si désactivé ou sans endpoint', () => {
    expect(shouldForward({ ...base, enabled: false }, 'LOGIN_FAILED')).toBe(false)
    expect(shouldForward({ ...base, endpoint: '' }, 'LOGIN_FAILED')).toBe(false)
  })
  it('décide selon la catégorie AFFINÉE par le scope (données vs config)', () => {
    const cfgDonnees = { enabled: true, endpoint: 'https://siem/ingest', categories: ['DONNEES'] as string[] }
    // Un upload de document (scope document) doit être forwardé au journal DONNEES…
    expect(shouldForward(cfgDonnees, 'ORGANIZATION_CONFIG_UPDATED', { scope: 'document' })).toBe(true)
    // …et PAS au journal CONFIGURATION seul.
    const cfgConfig = { ...cfgDonnees, categories: ['CONFIGURATION'] as string[] }
    expect(shouldForward(cfgConfig, 'ORGANIZATION_CONFIG_UPDATED', { scope: 'document' })).toBe(false)
    // Une vraie modif de config (scope branding) reste dans CONFIGURATION.
    expect(shouldForward(cfgConfig, 'ORGANIZATION_CONFIG_UPDATED', { scope: 'branding' })).toBe(true)
  })
})

describe('buildSiemEvent', () => {
  it('produit un événement structuré normalisé', () => {
    const now = new Date('2026-09-10T12:00:00.000Z')
    const ev = buildSiemEvent('LOGIN_FAILED', { userEmail: 'a@b.c', ip: '1.2.3.4', details: { reason: 'bad_password' } }, now)
    expect(ev).toMatchObject({
      source: 'acra',
      action: 'LOGIN_FAILED',
      category: 'AUTHENTIFICATION',
      severity: 'warning',
      timestamp: '2026-09-10T12:00:00.000Z',
      userEmail: 'a@b.c',
      ip: '1.2.3.4',
    })
    expect(ev.details).toEqual({ reason: 'bad_password' })
  })
})
