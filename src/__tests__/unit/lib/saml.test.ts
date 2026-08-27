import { describe, it, expect } from 'vitest'
import {
  SAML_PROVIDER_ID,
  validateSamlConfig,
  isPemCertificate,
  extractSamlClaims,
} from '@/lib/saml'

describe('SAML_PROVIDER_ID', () => {
  it('vaut « saml »', () => expect(SAML_PROVIDER_ID).toBe('saml'))
})

describe('validateSamlConfig', () => {
  const ok = {
    samlEntityId: 'https://acra.example.com',
    samlSsoUrl: 'https://idp.example.com/sso',
    samlCertificate: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
  }
  it('accepte une config SAML valide', () => {
    expect(validateSamlConfig(ok)).toBeNull()
  })
  it('exige un entity ID', () => {
    expect(validateSamlConfig({ ...ok, samlEntityId: '' })).toBe('entity_id_requis')
  })
  it('exige une URL SSO https publique', () => {
    expect(validateSamlConfig({ ...ok, samlSsoUrl: 'http://idp.example.com/sso' })).toBe('sso_url_invalide')
    expect(validateSamlConfig({ ...ok, samlSsoUrl: 'https://127.0.0.1/sso' })).toBe('sso_url_invalide')
  })
  it('exige un certificat PEM', () => {
    expect(validateSamlConfig({ ...ok, samlCertificate: 'pas un pem' })).toBe('certificat_invalide')
  })
})

describe('isPemCertificate', () => {
  it('reconnaît un bloc PEM', () => {
    expect(isPemCertificate('-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----')).toBe(true)
    expect(isPemCertificate('abc')).toBe(false)
    expect(isPemCertificate(null)).toBe(false)
  })
})

describe('extractSamlClaims', () => {
  it('extrait e-mail, nom et groupes via des noms d’attributs usuels', () => {
    const c = extractSamlClaims({
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'alice@acme.com',
      displayName: 'Alice',
      memberOf: ['grp-rssi', 'grp-lecture'],
    })
    expect(c.email).toBe('alice@acme.com')
    expect(c.name).toBe('Alice')
    expect(c.groups).toEqual(['grp-rssi', 'grp-lecture'])
  })
  it('gère les valeurs en tableau et la casse des clés', () => {
    const c = extractSamlClaims({ Email: ['bob@acme.com'], Groups: 'g1' })
    expect(c.email).toBe('bob@acme.com')
    expect(c.groups).toEqual(['g1'])
  })
  it('champs absents → undefined / vide', () => {
    const c = extractSamlClaims({})
    expect(c.email).toBeUndefined()
    expect(c.groups).toEqual([])
  })
})
