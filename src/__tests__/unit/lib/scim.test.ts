import { describe, it, expect } from 'vitest'
import {
  scimUserToAcra,
  acraUserToScim,
  parseScimUserNameFilter,
  applyScimPatch,
  scimListResponse,
  scimError,
  SCIM_USER_SCHEMA,
} from '@/lib/scim'

describe('scimUserToAcra', () => {
  it('extrait e-mail (userName), nom et active', () => {
    const r = scimUserToAcra({
      userName: 'Alice@Acme.com', displayName: 'Alice Doe', active: true,
      name: { givenName: 'Alice', familyName: 'Doe' },
    })
    expect(r).toEqual({ email: 'alice@acme.com', name: 'Alice Doe', active: true })
  })
  it('replie sur emails[primary] et name.formatted, active défaut true', () => {
    const r = scimUserToAcra({ emails: [{ value: 'bob@acme.com', primary: true }], name: { formatted: 'Bob' } })
    expect(r).toEqual({ email: 'bob@acme.com', name: 'Bob', active: true })
  })
  it('sans e-mail → null', () => {
    expect(scimUserToAcra({ displayName: 'x' })).toBeNull()
  })
})

describe('acraUserToScim', () => {
  it('mappe un utilisateur ACRA vers une ressource SCIM', () => {
    const s = acraUserToScim({ id: 'u1', email: 'a@acme.com', name: 'Alice', isActive: true })
    expect(s.schemas).toEqual([SCIM_USER_SCHEMA])
    expect(s.id).toBe('u1')
    expect(s.userName).toBe('a@acme.com')
    expect(s.active).toBe(true)
    expect(s.emails?.[0]).toEqual({ value: 'a@acme.com', primary: true })
  })
})

describe('parseScimUserNameFilter', () => {
  it('parse userName eq "x"', () => {
    expect(parseScimUserNameFilter('userName eq "alice@acme.com"')).toBe('alice@acme.com')
    expect(parseScimUserNameFilter('userName Eq "BOB@acme.com"')).toBe('bob@acme.com')
  })
  it('filtre non supporté → null', () => {
    expect(parseScimUserNameFilter('displayName eq "x"')).toBeNull()
    expect(parseScimUserNameFilter('')).toBeNull()
    expect(parseScimUserNameFilter(undefined)).toBeNull()
  })
})

describe('applyScimPatch', () => {
  const base = { active: true, name: 'Alice' }
  it('désactive via op replace path=active (déprovisioning Azure AD)', () => {
    expect(applyScimPatch(base, [{ op: 'Replace', path: 'active', value: false }])).toEqual({ active: false, name: 'Alice' })
  })
  it('accepte value booléen sous forme de chaîne', () => {
    expect(applyScimPatch(base, [{ op: 'replace', path: 'active', value: 'False' }]).active).toBe(false)
  })
  it('op replace sans path avec objet value', () => {
    expect(applyScimPatch(base, [{ op: 'replace', value: { active: false, displayName: 'Alice D' } }])).toEqual({ active: false, name: 'Alice D' })
  })
  it('ignore les ops inconnues sans casser', () => {
    expect(applyScimPatch(base, [{ op: 'add', path: 'foo', value: 1 }])).toEqual(base)
  })
})

describe('enveloppes SCIM', () => {
  it('scimListResponse', () => {
    const l = scimListResponse([{ id: 'u1' }], 1)
    expect(l.schemas).toContain('urn:ietf:params:scim:api:messages:2.0:ListResponse')
    expect(l.totalResults).toBe(1)
    expect(l.Resources).toHaveLength(1)
  })
  it('scimError porte le statut et le détail', () => {
    const e = scimError(404, 'introuvable')
    expect(e.status).toBe('404')
    expect(e.detail).toBe('introuvable')
    expect(e.schemas).toContain('urn:ietf:params:scim:api:messages:2.0:Error')
  })
})
