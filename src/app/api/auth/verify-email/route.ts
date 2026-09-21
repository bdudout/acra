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
 * Ouvert à tout compte qui EXIGE la vérification (inscription publique) ou sur une
 * instance de démo (F07). Réponses volontairement UNIFORMES (pas d'énumération de
 * comptes, F06). Le code a un TTL court et un nombre d'essais borné (infra MFA
 * réutilisée). Rate-limit par IP + par adresse de destination.
 */
const schema = z.object({
  email: z.string().email(),
  code: z.string().max(12).optional(),
  action: z.enum(['verify', 'resend']).default('verify'),
})

// POST /api/auth/verify-email — vérifie un e-mail via son code OTP et active le compte.
export async function POST(req: NextRequest) {
  let parsed: z.infer<typeof schema>
  try {
    parsed = schema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  }
  const email = parsed.email.toLowerCase().trim()
  const ip = getClientIp(req)
  const demo = await isDemoInstance()

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerified: true, emailVerificationRequired: true },
  })

  // F07 (CWE-841) : le parcours de vérification est ouvert à tout compte qui
  // l'EXIGE (inscription publique) OU sur une instance de démo — plus seulement
  // en démo. Un compte déjà vérifié ou provisionné (admin/IdP) n'est pas éligible.
  const eligible = !!user && !user.emailVerified && (demo || user.emailVerificationRequired === true)

  if (parsed.action === 'resend') {
    // Anti mail-bombing : par adresse (3 / 15 min) ET par IP (5 / 15 min).
    const byDest = await rateLimit(`emailverif:${email}`, 3, 15 * 60 * 1000)
    const byIp = await rateLimit(`emailverif-ip:${ip}`, 5, 15 * 60 * 1000)
    if (!byDest.allowed || !byIp.allowed) {
      const rl = !byDest.allowed ? byDest : byIp
      return NextResponse.json(
        { error: 'Trop de demandes. Réessayez plus tard.' },
        { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
      )
    }
    if (eligible && user) {
      const sent = await createAndSendChallenge({ userId: user.id, channel: 'EMAIL', destination: user.email })
      if (sent.ok) await auditLog('EMAIL_VERIFICATION_SENT', { userId: user.id, userEmail: user.email, ip })
    }
    // Réponse générique (ne révèle ni l'existence ni l'état du compte).
    return NextResponse.json({ ok: true })
  }

  // action « verify »
  const byIp = await rateLimit(`emailverify-ip:${ip}`, 15, 15 * 60 * 1000)
  if (!byIp.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez plus tard.' },
      { status: 429, headers: rateLimitHeaders(byIp.remaining, byIp.resetAt) },
    )
  }
  if (!parsed.code) return NextResponse.json({ error: 'CODE_REQUIRED' }, { status: 400 })
  // F06 (CWE-204) : réponse UNIFORME (400 INVALID_CODE) pour compte absent, déjà
  // vérifié ou non éligible — aucune distinction observable de l'existence/état.
  if (!eligible || !user) return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 })

  const result = await verifyChallenge(user.id, parsed.code.trim())
  if (!result.ok) {
    // Pas de `reason` dans une réponse anonyme (uniformité) — le détail reste journalisé.
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 })
  }
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } })
  await auditLog('EMAIL_VERIFIED', { userId: user.id, userEmail: user.email, ip })
  return NextResponse.json({ ok: true })
}
