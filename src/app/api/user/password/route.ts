import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { validatePassword, DEFAULT_POLICY } from '@/lib/password-policy'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_PASSWORD } from '@/lib/rate-limit'

const Schema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(1),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId = (session.user as any).id

  // Rate limiting : 5 changements de mot de passe / heure par utilisateur
  const rl = rateLimit(`password:${userId}`, LIMIT_PASSWORD.limit, LIMIT_PASSWORD.windowMs)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans une heure.' },
      { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) }
    )
  }
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const policyRow = await (prisma as any).passwordPolicy.findUnique({ where: { id: 'global' } })
  const policy = policyRow ?? DEFAULT_POLICY

  if (validatePassword(newPassword, policy).length > 0) {
    // Code générique traduit côté client (le détail par règle est affiché dans le formulaire)
    return NextResponse.json({ error: 'PASSWORD_POLICY' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.user as any).update({
    where: { id: userId },
    // Efface le drapeau de changement forcé (#10/#11)
    data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false },
  })

  await auditLog('PASSWORD_CHANGED', {
    userId, userEmail: user.email,
    ip: getClientIp(req),
  })
  return NextResponse.json({ ok: true })
}
