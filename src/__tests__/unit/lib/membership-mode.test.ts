import { describe, it, expect } from 'vitest'
import { resolveMembershipMode, cleanMembershipMode, newInvitationToken, hashInvitationToken, invitationState, invitationMatchesEmail } from '@/lib/membership-mode'

describe('mode de rattachement (T23)', () => {
  it('AUTO : invitation sur une instance ouverte, ajout direct sur site', () => {
    expect(resolveMembershipMode('AUTO', true)).toBe('INVITATION')
    expect(resolveMembershipMode('AUTO', false)).toBe('DIRECT')
  })
  it('le réglage forcé l\'emporte sur l\'ouverture de l\'instance', () => {
    expect(resolveMembershipMode('INVITATION', false)).toBe('INVITATION')
    expect(resolveMembershipMode('DIRECT', true)).toBe('DIRECT')
  })
  it('valeur inconnue → AUTO', () => {
    expect(cleanMembershipMode('SUPER')).toBe('AUTO')
    expect(cleanMembershipMode(null)).toBe('AUTO')
    expect(resolveMembershipMode(42, true)).toBe('INVITATION')
  })
})

describe('jeton d\'invitation', () => {
  it('seul le hachage est conservé ; le jeton clair redonne le même hachage', () => {
    const { token, tokenHash } = newInvitationToken()
    expect(token.length).toBeGreaterThanOrEqual(43)
    expect(tokenHash).not.toContain(token)
    expect(hashInvitationToken(token)).toBe(tokenHash)
  })
  it('deux jetons sont différents', () => {
    expect(newInvitationToken().token).not.toBe(newInvitationToken().token)
  })
})

describe('état et destinataire', () => {
  const now = new Date('2026-10-01T12:00:00Z')
  it('valide, expirée, déjà utilisée', () => {
    expect(invitationState({ expiresAt: '2026-10-02T00:00:00Z' }, now)).toBe('VALID')
    expect(invitationState({ expiresAt: '2026-10-01T12:00:00Z' }, now)).toBe('EXPIRED')
    expect(invitationState({ expiresAt: '2026-10-02T00:00:00Z', acceptedAt: '2026-10-01T10:00:00Z' }, now)).toBe('USED')
  })
  it('l\'invitation ne vaut que pour son destinataire', () => {
    expect(invitationMatchesEmail('Alice@Acme.fr', ' alice@acme.fr ')).toBe(true)
    expect(invitationMatchesEmail('alice@acme.fr', 'bob@acme.fr')).toBe(false)
    expect(invitationMatchesEmail('alice@acme.fr', null)).toBe(false)
  })
})
