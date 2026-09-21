// Résolveur de politique de connexion (pur) — O01 (contre-audit 2026-09-21) :
// une politique ILLISIBLE ne doit pas dégrader la posture MFA en silence.
import { describe, it, expect } from 'vitest'
import { resolveLoginPolicy, MFA_DISABLED, MFA_FAILCLOSED } from '@/lib/login-policy'

describe('resolveLoginPolicy — O01 fail-closed', () => {
  it('erreur de lecture → MFA IMPOSÉE (fail-closed), scope ALL', () => {
    const p = resolveLoginPolicy(null, true)
    expect(p.mfa).toEqual(MFA_FAILCLOSED)
    expect(p.mfa.mfaEnabled).toBe(true)
    expect(p.mfa.mfaScope).toBe('ALL')
  })

  it('erreur de lecture l\'emporte même si une ligne est fournie', () => {
    // Défense en profondeur : si readError, on ignore toute ligne partielle.
    const p = resolveLoginPolicy({ mfaEnabled: false }, true)
    expect(p.mfa.mfaEnabled).toBe(true)
  })

  it('aucune politique configurée (null, sans erreur) → neutre (MFA désactivée)', () => {
    const p = resolveLoginPolicy(null, false)
    expect(p.mfa).toEqual(MFA_DISABLED)
    expect(p.mfa.mfaEnabled).toBe(false)
  })

  it('politique présente → projetée fidèlement (MFA ADMIN_ONLY conservé)', () => {
    const p = resolveLoginPolicy(
      { maxFailedAttempts: 5, lockoutDurationMinutes: 30, maxAgeDays: 90, mfaEnabled: true, mfaScope: 'ADMIN_ONLY', mfaMethodSms: true },
      false,
    )
    expect(p.maxFailedAttempts).toBe(5)
    expect(p.lockoutDurationMinutes).toBe(30)
    expect(p.maxAgeDays).toBe(90)
    expect(p.mfa.mfaEnabled).toBe(true)
    expect(p.mfa.mfaScope).toBe('ADMIN_ONLY')
    expect(p.mfa.mfaMethodSms).toBe(true)
    expect(p.mfa.mfaMethodEmail).toBe(true) // défaut sûr (≠ false)
  })

  it('champs absents → défauts sûrs', () => {
    const p = resolveLoginPolicy({ mfaEnabled: true }, false)
    expect(p.maxFailedAttempts).toBe(0)
    expect(p.lockoutDurationMinutes).toBe(15)
    expect(p.mfa.mfaScope).toBe('ALL')
    expect(p.mfa.mfaMethodSms).toBe(false)
  })
})
