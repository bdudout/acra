import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { auditLog, getClientIp } from '@/lib/logger'
import { isDemoInstance } from '@/lib/demo-server'
import { createAndSendChallenge, verifyChallenge } from '@/lib/mfa-service'

/**
 * POST /api/auth/verify-email — vérification d'e-mail à l'inscription (mode démo).
 *
 *  - action « verify »  : { email, code } → valide le code OTP → `emailVerified = now`.
 *  - action « resend »  : { email }       → renvoie un code (rate-limité, anti-bombing).
 *
 * Réservé aux instances de démo prouvées (`isDemoInstance()`). Réponses volontairement
 * génériques (pas d'énumération de comptes). Le code a un TTL court et un nombre
 * d'essais borné (infra MFA réutilisée). Rate-limit par IP + par adresse de destination.
 */
const schema = z.object({
  email: z.string().email(),
  code: z.string().max(12).optional(),
  action: z.enum(['verify', 'resend']).default('verify'),
})

export async function POST(req: NextRequest) {
  if (!(await isDemoInstance())) {
    return NextResponse.json({ error: 'Instance non démo' }, { status: 403 })
  }

  let parsed: z.infer<typeof schema>
  try {
    parsed = schema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  }
  const email = parsed.email.toLowerCase().trim()
  const ip = getClientIp(req)

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerified: true },
  })

  if (parsed.action === 'resend') {
    // Anti mail-bombing : par adresse (3 / 15 min) ET par IP (5 / 15 min).
    const byDest = rateLimit(`emailverif:${email}`, 3, 15 * 60 * 1000)
    const byIp = rateLimit(`emailverif-ip:${ip}`, 5, 15 * 60 * 1000)
    if (!byDest.allowed || !byIp.allowed) {
      const rl = !byDest.allowed ? byDest : byIp
      return NextResponse.json(
        { error: 'Trop de demandes. Réessayez plus tard.' },
        { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
      )
    }
    if (user && !user.emailVerified) {
      const sent = await createAndSendChallenge({ userId: user.id, channel: 'EMAIL', destination: user.email })
      if (sent.ok) await auditLog('EMAIL_VERIFICATION_SENT', { userId: user.id, userEmail: user.email, ip })
    }
    // Réponse générique (ne révèle pas l'existence du compte).
    return NextResponse.json({ ok: true })
  }

  // action « verify »
  const byIp = rateLimit(`emailverify-ip:${ip}`, 15, 15 * 60 * 1000)
  if (!byIp.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez plus tard.' },
      { status: 429, headers: rateLimitHeaders(byIp.remaining, byIp.resetAt) },
    )
  }
  if (!parsed.code) return NextResponse.json({ error: 'CODE_REQUIRED' }, { status: 400 })
  if (!user) return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 })
  if (user.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true })

  const result = await verifyChallenge(user.id, parsed.code.trim())
  if (!result.ok) {
    return NextResponse.json({ error: 'INVALID_CODE', reason: result.error }, { status: 400 })
  }
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } })
  await auditLog('EMAIL_VERIFIED', { userId: user.id, userEmail: user.email, ip })
  return NextResponse.json({ ok: true })
}
