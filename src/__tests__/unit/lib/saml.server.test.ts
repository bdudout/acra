import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ssoFindUnique = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { sSOConfig: { findUnique: (...a: unknown[]) => ssoFindUnique(...a) } } }))

import { isSamlMaintenanceMode, samlActive } from '@/lib/saml.server'

const VALID_SAML = {
  id: 'global', enabled: true, protocol: 'SAML',
  samlEntityId: 'https://acra.example.com', samlSsoUrl: 'https://idp.example.com/sso',
  samlCertificate: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
}

describe('SAML — mode maintenance', () => {
  const prev = process.env.SSO_SAML_ENABLED
  beforeEach(() => { ssoFindUnique.mockReset() })
  afterEach(() => { if (prev === undefined) delete process.env.SSO_SAML_ENABLED; else process.env.SSO_SAML_ENABLED = prev })

  it('maintenance activée par défaut (flag absent)', () => {
    delete process.env.SSO_SAML_ENABLED
    expect(isSamlMaintenanceMode()).toBe(true)
  })
  it('SAML inactif en maintenance même avec une config valide', async () => {
    delete process.env.SSO_SAML_ENABLED
    ssoFindUnique.mockResolvedValue(VALID_SAML)
    expect(await samlActive()).toBe(false)
  })
  it('flag levé + config valide → actif', async () => {
    process.env.SSO_SAML_ENABLED = 'true'
    ssoFindUnique.mockResolvedValue(VALID_SAML)
    expect(isSamlMaintenanceMode()).toBe(false)
    expect(await samlActive()).toBe(true)
  })
  it('flag levé mais config incomplète/non-SAML → inactif', async () => {
    process.env.SSO_SAML_ENABLED = 'true'
    ssoFindUnique.mockResolvedValue({ ...VALID_SAML, samlCertificate: 'invalide' })
    expect(await samlActive()).toBe(false)
    ssoFindUnique.mockResolvedValue({ ...VALID_SAML, protocol: 'OIDC' })
    expect(await samlActive()).toBe(false)
  })
})
