import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { auditLog } from '@/lib/logger'
import { resolveSessionCookie } from '@/lib/auth-cookies'
import { canIssueTrustedDevice, TRUSTED_DEVICE_COOKIE } from '@/lib/trusted-device'
import { createTrustedDevice } from '@/lib/trusted-device.server'

/** POST : après un OTP récent, crée le cookie HttpOnly d'un appareil approuvé. */
export async function POST() {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id?: string; mfaVerifiedAt?: number } | undefined
  if (!user?.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const policy = await prisma.passwordPolicy.findUnique({
    where: { id: 'global' },
    select: { trustedDeviceEnabled: true, trustedDeviceDurationDays: true, mfaEnabled: true, mfaPendingConfirmation: true, mfaMethodEmail: true },
  })
  const allowed = canIssueTrustedDevice({
    featureEnabled: policy?.trustedDeviceEnabled === true,
    mfaEnabled: policy?.mfaEnabled === true && policy?.mfaPendingConfirmation !== true,
    emailOtpEnabled: policy?.mfaMethodEmail === true,
    mfaVerifiedAt: user.mfaVerifiedAt,
  })
  if (!allowed) return NextResponse.json({ error: 'Indisponible' }, { status: 403 })

  const device = await createTrustedDevice(user.id, policy?.trustedDeviceDurationDays ?? 30)
  const sessionCookie = resolveSessionCookie()
  const response = NextResponse.json({ ok: true, expiresAt: device.expiresAt.toISOString() })
  response.cookies.set({
    name: TRUSTED_DEVICE_COOKIE,
    value: device.token,
    expires: device.expiresAt,
    httpOnly: true,
    sameSite: 'lax',
    secure: sessionCookie.secure,
    path: '/',
  })
  await auditLog('TRUSTED_DEVICE_CREATED', { userId: user.id, targetType: 'trusted_device' })
  return response
}
