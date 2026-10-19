import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { validatePassword, DEFAULT_POLICY } from '@/lib/password-policy'
import { auditLog, getClientIp } from '@/lib/logger'
import { LIMIT_PASSWORD } from '@/lib/rate-limit'
import { withAccess } from '@/lib/with-access.server'

const Schema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(1),
})

// POST /api/user/password — change le mot de passe de l'utilisateur connecté (vérifie l'ancien, applique la politique).
// Rate limiting : 5 changements de mot de passe / heure par utilisateur
export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'password', limit: LIMIT_PASSWORD.limit, windowMs: LIMIT_PASSWORD.windowMs } }, async (req, { user: sessionUser }) => {
  const userId = sessionUser.id

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  }

  const { currentPassword, newPassword } = parsed.data

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.passwordHash) {
    return NextResponse.json({ error: 'Impossible de changer le mot de passe pour ce compte' }, { status: 400 })
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 400 })
  }

  // Récupérer la politique
  const policyRow = await prisma.passwordPolicy.findUnique({ where: { id: 'global' } })
  const policy = policyRow ?? DEFAULT_POLICY

  if (validatePassword(newPassword, policy).length > 0) {
    // Code générique traduit côté client (le détail par règle est affiché dans le formulaire)
    return NextResponse.json({ error: 'PASSWORD_POLICY' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.$transaction(async tx => {
    await tx.user.update({
      where: { id: userId },
      // Efface le drapeau de changement forcé (#10/#11) ; F04 : révoque les
      // sessions/JWT antérieurs (incrément de version).
      data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false, sessionVersion: { increment: 1 } },
    })
    // Un changement de mot de passe invalide les cookies d'appareils approuvés.
    await tx.trustedDevice.deleteMany({ where: { userId } })
  })

  await auditLog('PASSWORD_CHANGED', {
    userId, userEmail: user.email,
    ip: getClientIp(req),
  })
  return NextResponse.json({ ok: true })
})
