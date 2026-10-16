import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog } from '@/lib/logger'
import { resolveSessionCookie } from '@/lib/auth-cookies'
import { canIssueTrustedDevice, TRUSTED_DEVICE_COOKIE } from '@/lib/trusted-device'
import { createTrustedDevice } from '@/lib/trusted-device.server'
import { requireSession } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'

/** POST : après un OTP récent, crée le cookie HttpOnly d'un appareil approuvé. */
// `mfaVerifiedAt` (horodatage OTP du JWT) n'est pas porté par le contexte de withAccess : relu via requireSession.
export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'trusted-device' } }, async () => {
  const g = await requireSession()
  if (g.error) return g.error
  const user = { id: g.user.id, mfaVerifiedAt: (g.session.user as { mfaVerifiedAt?: number }).mfaVerifiedAt }

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
})
