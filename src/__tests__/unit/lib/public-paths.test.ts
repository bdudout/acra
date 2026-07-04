import { describe, it, expect } from 'vitest'
import { isPublicPath } from '@/lib/public-paths'

describe('isPublicPath — accès sans authentification', () => {
  it('autorise le endpoint de santé (sondé par le healthcheck Docker)', () => {
    expect(isPublicPath('/api/health')).toBe(true)
    expect(isPublicPath('/api/health/')).toBe(true)
  })

  it('autorise les pages et API d’authentification', () => {
    expect(isPublicPath('/auth/signin')).toBe(true)
    expect(isPublicPath('/auth/register')).toBe(true)
    expect(isPublicPath('/api/auth/session')).toBe(true)
  })

  it('autorise la racine et les pages légales', () => {
    expect(isPublicPath('/')).toBe(true)
    expect(isPublicPath('/legal/mentions')).toBe(true)
    expect(isPublicPath('/legal/privacy')).toBe(true)
  })

  it('protège les pages applicatives', () => {
    expect(isPublicPath('/dashboard')).toBe(false)
    expect(isPublicPath('/analyses')).toBe(false)
    expect(isPublicPath('/admin')).toBe(false)
    expect(isPublicPath('/risques')).toBe(false)
  })

  it('protège les autres API (y compris celles dont le préfixe ressemble à une route publique)', () => {
    expect(isPublicPath('/api/analyses')).toBe(false)
    expect(isPublicPath('/api/admin/users')).toBe(false)
    // ne doit pas confondre /api/healthcheck-something avec /api/health exact
    expect(isPublicPath('/api/health-internal')).toBe(false)
  })

  it('autorise les endpoints cron (auth propre par CRON_SECRET), sans confusion de préfixe', () => {
    expect(isPublicPath('/api/cron/conformite-snapshots')).toBe(true)
    // pas de faux positif sur un préfixe voisin
    expect(isPublicPath('/api/cronjobs-secret')).toBe(false)
  })
})
