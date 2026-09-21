import { createHash } from 'crypto'

export const TRUSTED_DEVICE_COOKIE = 'acra_trusted_device'
export const TRUSTED_DEVICE_MIN_DAYS = 1
export const TRUSTED_DEVICE_MAX_DAYS = 90
export const TRUSTED_DEVICE_DEFAULT_DAYS = 30
export const TRUSTED_DEVICE_MFA_WINDOW_MS = 10 * 60 * 1000

/** Vue minimale d'un appareil de confiance (MFA) pour décider de sa validité : date d'expiration + révocation. */
export interface TrustedDeviceValiditySource {
  expiresAt: Date | string
  revokedAt: Date | string | null
}

/** Empêche une politique trop courte (inutilisable) ou trop longue (risque accru). */
export function clampTrustedDeviceDurationDays(value: number): number {
  if (!Number.isFinite(value)) return TRUSTED_DEVICE_DEFAULT_DAYS
  return Math.min(TRUSTED_DEVICE_MAX_DAYS, Math.max(TRUSTED_DEVICE_MIN_DAYS, Math.trunc(value)))
}

/** Calcule la date d'expiration d'un appareil de confiance à partir d'une durée en jours (bornée). */
export function trustedDeviceExpiry(durationDays: number, now = new Date()): Date {
  return new Date(now.getTime() + clampTrustedDeviceDurationDays(durationDays) * 86_400_000)
}

/** Un appareil révoqué ou arrivé à expiration ne peut jamais contourner l'OTP. */
export function isTrustedDeviceValid(device: TrustedDeviceValiditySource, now = new Date()): boolean {
  return !device.revokedAt && new Date(device.expiresAt).getTime() > now.getTime()
}

/** Seul le SHA-256 de l'opaque cookie est persisté. */
export function hashTrustedDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Lit la valeur opaque d'un cookie sans dépendre d'un runtime Next spécifique. */
export function cookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [key, ...rawValue] = part.trim().split('=')
    if (key === name) return rawValue.join('=') || null
  }
  return null
}

/** Exige une preuve MFA récente : une simple session existante ne suffit pas. */
export function canIssueTrustedDevice(input: {
  featureEnabled: boolean
  mfaEnabled: boolean
  emailOtpEnabled: boolean
  mfaVerifiedAt?: number
}, now = Date.now()): boolean {
  return input.featureEnabled
    && input.mfaEnabled
    && input.emailOtpEnabled
    && typeof input.mfaVerifiedAt === 'number'
    && input.mfaVerifiedAt <= now
    && now - input.mfaVerifiedAt <= TRUSTED_DEVICE_MFA_WINDOW_MS
}
