import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { auditLog, getClientIp } from '@/lib/logger'
import { isDemoInstance } from '@/lib/demo-server'
import { canSelfDeleteAccount } from '@/lib/self-service-account'
import { withAccess } from '@/lib/with-access.server'

const Schema = z.object({
  name: z.string().min(1).max(100),
  // Téléphone optionnel (format E.164 souple, ex. +33612345678) — pour le MFA par SMS
  phone: z.string().trim().max(32).regex(/^\+?[0-9 .()-]*$/, 'Téléphone invalide').optional(),
})

// GET /api/user/profile — lit le profil de l'utilisateur connecté.
export const GET = withAccess({ org: 'none' }, async (_req, { user: sessionUser }) => {
  const userId = sessionUser.id
  const [user, demo, policy] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true, phone: true } }),
    isDemoInstance(),
    prisma.passwordPolicy.findUnique({ where: { id: 'global' }, select: { selfServiceAccountDeletion: true } }),
  ])
  return NextResponse.json({
    user,
    selfServiceAccountDeletion: canSelfDeleteAccount({ demo, enabled: policy?.selfServiceAccountDeletion === true, authenticated: true }),
  })
})

// PATCH /api/user/profile — met à jour le profil de l'utilisateur connecté (nom, langue…).
export const PATCH = withAccess({ org: 'none', rateLimit: { bucket: 'user-profile' } }, async (req, { user: sessionUser }) => {
  const userId = sessionUser.id
  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides (nom 1–100 caractères, téléphone optionnel)' }, { status: 400 })
  }

  const { name, phone } = parsed.data
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name, ...(phone !== undefined ? { phone: phone.trim() || null } : {}) },
    select: { id: true, name: true, email: true, phone: true },
  })

  await auditLog('PROFILE_UPDATED', {
    userId, userEmail: user.email,
    ip: getClientIp(req),
    details: { action: 'profile updated' },
  })

  return NextResponse.json({ ok: true, user })
})
