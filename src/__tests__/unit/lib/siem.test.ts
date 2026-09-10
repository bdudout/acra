import { describe, it, expect } from 'vitest'
import {
  SIEM_CATEGORIES,
  categoryForAction,
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
