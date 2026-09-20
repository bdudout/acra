import { describe, expect, it } from 'vitest'
import { canSelfDeleteAccount, deletableOrganizationIds } from '@/lib/self-service-account'

describe('canSelfDeleteAccount', () => {
  it('refuse par défaut et hors démo', () => {
    expect(canSelfDeleteAccount({ demo: false, enabled: true, authenticated: true })).toBe(false)
    expect(canSelfDeleteAccount({ demo: true, enabled: false, authenticated: true })).toBe(false)
  })
  it('autorise uniquement un utilisateur authentifié quand la politique démo est activée', () => {
    expect(canSelfDeleteAccount({ demo: true, enabled: true, authenticated: false })).toBe(false)
    expect(canSelfDeleteAccount({ demo: true, enabled: true, authenticated: true })).toBe(true)
  })

  it('ne supprime que les organisations personnelles, jamais une organisation partagée ou racine', () => {
    expect(deletableOrganizationIds([
      { organizationId: 'demo-brice', memberCount: 1 },
      { organizationId: 'shared-team', memberCount: 3 },
      { organizationId: 'global', memberCount: 1 },
    ])).toEqual(['demo-brice'])
  })
})
