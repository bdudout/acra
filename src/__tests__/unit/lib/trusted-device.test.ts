import { describe, expect, it } from 'vitest'
import {
  clampTrustedDeviceDurationDays,
  canIssueTrustedDevice,
  cookieValue,
  hashTrustedDeviceToken,
  isTrustedDeviceValid,
  trustedDeviceExpiry,
} from '@/lib/trusted-device'

describe('trusted devices', () => {
  it('borne la durée configurée et calcule une expiration prévisible', () => {
    expect(clampTrustedDeviceDurationDays(0)).toBe(1)
    expect(clampTrustedDeviceDurationDays(365)).toBe(90)
    expect(trustedDeviceExpiry(30, new Date('2026-09-20T12:00:00Z'))).toEqual(new Date('2026-10-20T12:00:00Z'))
  })

  it('n’accepte qu’un appareil ni révoqué ni expiré', () => {
    const now = new Date('2026-09-20T12:00:00Z')
    expect(isTrustedDeviceValid({ expiresAt: new Date('2026-09-21T12:00:00Z'), revokedAt: null }, now)).toBe(true)
    expect(isTrustedDeviceValid({ expiresAt: new Date('2026-09-20T12:00:00Z'), revokedAt: null }, now)).toBe(false)
    expect(isTrustedDeviceValid({ expiresAt: new Date('2026-09-21T12:00:00Z'), revokedAt: new Date() }, now)).toBe(false)
  })

  it('hache le jeton sans le conserver en clair', () => {
    expect(hashTrustedDeviceToken('jeton-opaqe')).toMatch(/^[a-f0-9]{64}$/)
    expect(hashTrustedDeviceToken('jeton-opaqe')).not.toBe('jeton-opaqe')
  })

  it('lit un cookie nommé sans accepter une valeur partielle', () => {
    expect(cookieValue('theme=dark; acra_trusted_device=opaque; session=x', 'acra_trusted_device')).toBe('opaque')
    expect(cookieValue('not_acra_trusted_device=opaque', 'acra_trusted_device')).toBeNull()
  })

  it('n’émet un appareil qu’immédiatement après un OTP e-mail réussi', () => {
    const now = Date.parse('2026-09-20T12:00:00Z')
    const base = { featureEnabled: true, mfaEnabled: true, emailOtpEnabled: true, mfaVerifiedAt: now - 60_000 }
    expect(canIssueTrustedDevice(base, now)).toBe(true)
    expect(canIssueTrustedDevice({ ...base, mfaVerifiedAt: now - 11 * 60_000 }, now)).toBe(false)
    expect(canIssueTrustedDevice({ ...base, featureEnabled: false }, now)).toBe(false)
  })
})
