import { describe, it, expect } from 'vitest'
import { isPrivateIp, isInternalHostname } from '@/lib/ip-safety'
import { isSafeWebhookUrl } from '@/lib/webhook'
import { validateSyncEndpoint, validateLdapEndpoint } from '@/lib/entity-sync'
import { isSafeIssuerUrl } from '@/lib/sso'

// Audit 2026-09-30 (N02/N03) : contournements constatés sur les gardes SSRF dupliquées.
const PRIVATE = [
  '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.0.1', '169.254.169.254', '0.0.0.0',
  '100.64.0.1', '100.127.255.254', '198.18.0.1', '192.0.0.192', '224.0.0.1', '255.255.255.255',
  '::', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '[::ffff:0a00:0001]',
  'fd00:ec2::254', 'fe80::1', 'fec0::1', 'ff02::1', '2001:db8::1', '64:ff9b::7f00:1', '2002:7f00:1::1',
  '::7f00:1', '', 'pas-une-ip',
]
const PUBLIC = ['8.8.8.8', '1.1.1.1', '172.15.255.255', '172.32.0.1', '100.63.255.255', '198.20.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']

describe('isPrivateIp', () => {
  it.each(PRIVATE)('refuse %s', ip => expect(isPrivateIp(ip)).toBe(true))
  it.each(PUBLIC)('accepte %s', ip => expect(isPrivateIp(ip)).toBe(false))
})

describe('isInternalHostname', () => {
  it.each(['localhost', 'localhost.', 'LOCALHOST..', 'a.localhost', 'svc.internal', 'printer.local', 'metadata', 'x.corp', 'router.lan', '', '[::1]', '127.0.0.1'])('interne : %s', h => expect(isInternalHostname(h)).toBe(true))
  it.each(['hooks.example.com', 'sso.contoso.io', 'a.b.example.org', '8.8.8.8'])('public : %s', h => expect(isInternalHostname(h)).toBe(false))
})

const BYPASSES = [
  'https://[::ffff:127.0.0.1]/', 'https://[::ffff:a9fe:a9fe]/', 'https://[::]/', 'https://localhost./x',
  'https://100.64.0.1/x', 'https://198.18.0.1/x', 'https://metadata.google.internal/x', 'https://internal.corp/x',
  'https://0x7f.1/x', 'https://2130706433/x', 'https://user:pw@hooks.example.com/x',
]

describe('gardes SSRF (webhook, issuer SSO/SAML, connecteurs REST/LDAP)', () => {
  it.each(BYPASSES)('refuse %s', url => {
    expect(isSafeWebhookUrl(url)).toBe(false)
    expect(isSafeIssuerUrl(url)).toBe(false)
    expect(validateSyncEndpoint(url)).toBeNull()
    expect(validateLdapEndpoint(url.replace('https:', 'ldaps:'))).toBeNull()
  })
  it('accepte une URL publique https', () => {
    expect(isSafeWebhookUrl('https://hooks.example.com/acra')).toBe(true)
    expect(validateSyncEndpoint('https://api.example.com/entities')).not.toBeNull()
    expect(validateLdapEndpoint('ldaps://ldap.example.com')).not.toBeNull()
  })
})
