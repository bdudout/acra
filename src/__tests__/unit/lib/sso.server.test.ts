import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks : Prisma (SSOConfig + User) et déchiffrement du secret.
const ssoFindUnique = vi.fn()
const userFindUnique = vi.fn()
const userUpdate = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    sSOConfig: { findUnique: (...a: unknown[]) => ssoFindUnique(...a) },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a), update: (...a: unknown[]) => userUpdate(...a), updateMany: (...a: unknown[]) => userUpdate(...a) },
  },
}))
vi.mock('@/lib/secret-crypto', () => ({ decryptSecret: (v: string | null) => v }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn() }))

import { loadSsoOidcConfig, ssoEnabled, ssoSignInDecision, syncSsoRoleFromClaims, isSsoLinkRefused } from '@/lib/sso.server'

const VALID = {
  id: 'global', enabled: true, protocol: 'OIDC',
  oidcIssuerUrl: 'https://acme.okta.com', oidcClientId: 'cid', oidcClientSecret: 'sec',
  oidcScopes: 'openid email profile', autoProvision: true, defaultRole: 'LECTEUR', allowedDomains: 'acme.com',
  oidcGroupsClaim: 'groups', roleMapping: { 'grp-rssi': 'RSSI' },
}

describe('loadSsoOidcConfig', () => {
  beforeEach(() => { ssoFindUnique.mockReset(); userFindUnique.mockReset() })

  it('retourne la config quand tout est valide et actif', async () => {
    ssoFindUnique.mockResolvedValue(VALID)
    const c = await loadSsoOidcConfig()
    expect(c).not.toBeNull()
    expect(c?.issuer).toBe('https://acme.okta.com')
    expect(c?.clientSecret).toBe('sec')
  })
  it('null si désactivé, non-OIDC, incomplet ou issuer non sûr', async () => {
    for (const patch of [{ enabled: false }, { protocol: 'SAML' }, { oidcClientId: '' }, { oidcIssuerUrl: 'https://127.0.0.1' }, { oidcIssuerUrl: 'http://acme.okta.com' }]) {
      ssoFindUnique.mockResolvedValue({ ...VALID, ...patch })
      expect(await loadSsoOidcConfig()).toBeNull()
    }
  })
  it('null si la table est absente (best-effort)', async () => {
    ssoFindUnique.mockRejectedValue(new Error('no table'))
    expect(await loadSsoOidcConfig()).toBeNull()
    expect(await ssoEnabled()).toBe(false)
  })
})

describe('ssoSignInDecision', () => {
  beforeEach(() => { ssoFindUnique.mockReset(); userFindUnique.mockReset(); ssoFindUnique.mockResolvedValue(VALID) })

  it('autorise un utilisateur existant du bon domaine', async () => {
    userFindUnique.mockResolvedValue({ id: 'u1' })
    expect(await ssoSignInDecision({ email: 'a@acme.com', email_verified: true })).toEqual({ ok: true })
  })
  it('autorise la création si autoProvision et domaine ok', async () => {
    userFindUnique.mockResolvedValue(null)
    expect(await ssoSignInDecision({ email: 'new@acme.com', email_verified: true })).toEqual({ ok: true })
  })
  it('refuse un domaine non autorisé', async () => {
    userFindUnique.mockResolvedValue(null)
    expect(await ssoSignInDecision({ email: 'x@autre.com', email_verified: true })).toEqual({ ok: false, reason: 'domaine_non_autorise' })
  })
  it('refuse quand le SSO est désactivé', async () => {
    ssoFindUnique.mockResolvedValue({ ...VALID, enabled: false })
    expect(await ssoSignInDecision({ email: 'a@acme.com' })).toEqual({ ok: false, reason: 'sso_desactive' })
  })
  it('T24 — refuse de lier une nouvelle identité IdP à un compte SUPER_ADMIN', async () => {
    userFindUnique.mockResolvedValue({ id: 'sa', role: 'SUPER_ADMIN', accounts: [] })
    expect(await ssoSignInDecision({ email: 'boss@acme.com', email_verified: true }, 'idp-123')).toEqual({ ok: false, reason: 'sso_liaison_super_admin_refusee' })
  })
  it('T24 — admet un SUPER_ADMIN déjà lié à CETTE identité', async () => {
    userFindUnique.mockResolvedValue({ id: 'sa', role: 'SUPER_ADMIN', accounts: [{ providerAccountId: 'idp-123' }] })
    expect(await ssoSignInDecision({ email: 'boss@acme.com', email_verified: true }, 'idp-123')).toEqual({ ok: true })
  })
})

describe('isSsoLinkRefused (T24)', () => {
  it('ne concerne que les SUPER_ADMIN', () => {
    expect(isSsoLinkRefused('ADMIN', [], 'x')).toBe(false)
    expect(isSsoLinkRefused('SUPER_ADMIN', [], 'x')).toBe(true)
    expect(isSsoLinkRefused('SUPER_ADMIN', ['y'], 'x')).toBe(true)
    expect(isSsoLinkRefused('SUPER_ADMIN', ['x'], 'x')).toBe(false)
    expect(isSsoLinkRefused('SUPER_ADMIN', ['x'], undefined)).toBe(true)
  })
})

describe('syncSsoRoleFromClaims', () => {
  beforeEach(() => { ssoFindUnique.mockReset(); userUpdate.mockReset(); ssoFindUnique.mockResolvedValue(VALID); userUpdate.mockResolvedValue({}) })

  it('mappe un groupe IdP vers un rôle et met à jour l’utilisateur', async () => {
    const role = await syncSsoRoleFromClaims('u1', { groups: ['grp-rssi'] })
    expect(role).toBe('RSSI')
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1', role: { not: 'SUPER_ADMIN' } }, data: { role: 'RSSI' } }))
  })
  it('sans mapping configuré → null, aucune écriture', async () => {
    ssoFindUnique.mockResolvedValue({ ...VALID, roleMapping: {} })
    expect(await syncSsoRoleFromClaims('u1', { groups: ['grp-rssi'] })).toBeNull()
    expect(userUpdate).not.toHaveBeenCalled()
  })
  it('claim de groupes personnalisé (ex. "roles")', async () => {
    ssoFindUnique.mockResolvedValue({ ...VALID, oidcGroupsClaim: 'roles' })
    expect(await syncSsoRoleFromClaims('u1', { roles: ['grp-rssi'] })).toBe('RSSI')
  })
  it('audit 2026-10-01 : l\'écriture exclut toujours un SUPER_ADMIN (jamais rétrogradé par l\'IdP)', async () => {
    await syncSsoRoleFromClaims('u1', { groups: [] }) // aucun groupe mappé → rôle par défaut
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1', role: { not: 'SUPER_ADMIN' } }, data: { role: 'LECTEUR' } }))
  })
})
