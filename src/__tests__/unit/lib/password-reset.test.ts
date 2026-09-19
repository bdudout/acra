import { describe, expect, it } from 'vitest'
import { hashResetToken, isResetTokenUsable, resolvePasswordResetMode, RESET_TOKEN_TTL_MS } from '@/lib/password-reset'

describe('password-reset', () => {
  it('hashes a token deterministically without retaining its clear value', () => {
    expect(hashResetToken('a-secure-token')).toHaveLength(64)
    expect(hashResetToken('a-secure-token')).toBe(hashResetToken('a-secure-token'))
    expect(hashResetToken('a-secure-token')).not.toContain('a-secure-token')
  })

  it('accepts only an unused, non-expired reset token', () => {
    const now = new Date('2026-09-19T12:00:00Z')
    expect(isResetTokenUsable({ expiresAt: new Date(now.getTime() + 1), usedAt: null }, now)).toBe(true)
    expect(isResetTokenUsable({ expiresAt: now, usedAt: null }, now)).toBe(false)
    expect(isResetTokenUsable({ expiresAt: new Date(now.getTime() + 1), usedAt: now }, now)).toBe(false)
  })

  it('forces self-service e-mail reset in a demo instance', () => {
    expect(resolvePasswordResetMode('ADMIN', true)).toBe('EMAIL')
    expect(resolvePasswordResetMode('ADMIN', false)).toBe('ADMIN')
    expect(resolvePasswordResetMode('EMAIL', false)).toBe('EMAIL')
  })

  it('has a short-lived reset link', () => {
    expect(RESET_TOKEN_TTL_MS).toBe(60 * 60 * 1000)
  })
})
