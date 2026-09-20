import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { hashTrustedDeviceToken, isTrustedDeviceValid, trustedDeviceExpiry } from '@/lib/trusted-device'

export function newTrustedDeviceToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Vérifie l'appareil pour le bon utilisateur et actualise uniquement sa dernière utilisation. */
export async function hasValidTrustedDevice(userId: string, token: string | null | undefined): Promise<boolean> {
  if (!token) return false
  const device = await prisma.trustedDevice.findUnique({
    where: { tokenHash: hashTrustedDeviceToken(token) },
    select: { id: true, userId: true, expiresAt: true, revokedAt: true },
  })
  if (!device || device.userId !== userId || !isTrustedDeviceValid(device)) return false
  await prisma.trustedDevice.update({ where: { id: device.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
  return true
}

/** Crée l'enregistrement correspondant au cookie qui sera envoyé par la route. */
export async function createTrustedDevice(userId: string, durationDays: number, label?: string | null) {
  const token = newTrustedDeviceToken()
  const expiresAt = trustedDeviceExpiry(durationDays)
  await prisma.trustedDevice.deleteMany({
    where: { userId, OR: [{ expiresAt: { lte: new Date() } }, { revokedAt: { not: null } }] },
  })
  await prisma.trustedDevice.create({
    data: { userId, tokenHash: hashTrustedDeviceToken(token), expiresAt, label: label?.trim().slice(0, 80) || null },
  })
  return { token, expiresAt }
}
