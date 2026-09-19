import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { sendEmail } from '@/lib/email'
import { emailLayout } from '@/lib/email-html'
import { isDemoInstance } from '@/lib/demo-server'
import { hashResetToken, RESET_TOKEN_TTL_MS, resolvePasswordResetMode, type PasswordResetMode } from '@/lib/password-reset'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

const schema = z.object({ email: z.string().email().max(254) })
const SUCCESS = { ok: true }

function resetUrl(token: string): string | null {
  const raw = process.env.NEXTAUTH_URL
  if (!raw) return null
  try {
    const origin = new URL(raw)
    if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:') return null
    return new URL(`/auth/reset-password?token=${encodeURIComponent(token)}`, origin).toString()
  } catch { return null }
}

/** Requests always return the same body, preventing account enumeration. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json(SUCCESS)
  const email = parsed.data.email.toLowerCase().trim()
  const ip = getClientIp(req)
  const limit = rateLimit(`password-reset:${email}`, 3, 15 * 60 * 1000)
  if (!limit.allowed) return NextResponse.json(SUCCESS, { headers: rateLimitHeaders(limit.remaining, limit.resetAt) })

  try {
    const [user, policy, demo] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true, email: true, isActive: true } }),
      prisma.passwordPolicy.findUnique({ where: { id: 'global' }, select: { passwordResetMode: true } }),
      isDemoInstance(),
    ])
    const mode = resolvePasswordResetMode((policy?.passwordResetMode === 'EMAIL' ? 'EMAIL' : 'ADMIN') as PasswordResetMode, demo)
    if (!user || !user.isActive || mode !== 'EMAIL') return NextResponse.json(SUCCESS)

    const clearToken = randomBytes(32).toString('base64url')
    const tokenHash = hashResetToken(clearToken)
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)
    // A newly requested link invalidates all preceding links for this account.
    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
      prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } }),
    ])
    const link = resetUrl(clearToken)
    if (!link) throw new Error('Missing or unsafe NEXTAUTH_URL')
    const text = `ACRA — Réinitialisez votre mot de passe : ${link}\n\nCe lien est valable une heure et ne peut être utilisé qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`
    const sent = await sendEmail({
      to: user.email,
      subject: 'ACRA — Réinitialisation de votre mot de passe',
      text,
      html: emailLayout({
        heading: 'Réinitialisez votre mot de passe',
        paragraphs: ['Une demande de réinitialisation a été reçue pour votre compte ACRA.', `Ouvrez ce lien dans l’heure : ${link}`],
        action: { label: 'Réinitialiser mon mot de passe', url: link },
        items: [{ label: 'Ce lien expire dans une heure et ne peut servir qu’une fois.' }, { label: 'Vous n’êtes pas à l’origine de la demande ? Ignorez cet e-mail.' }],
        tone: 'warning',
      }),
    })
    if (!sent.ok) {
      await prisma.passwordResetToken.updateMany({ where: { tokenHash, usedAt: null }, data: { usedAt: new Date() } })
      throw new Error(sent.error ?? 'mail failed')
    }
    await auditLog('PASSWORD_RESET_REQUESTED', { userId: user.id, userEmail: user.email, ip })
  } catch {
    // Same public response; audit failures are deliberately not exposed to an anonymous caller.
    await auditLog('PASSWORD_RESET_REQUEST_FAILED', { userEmail: email, ip }).catch(() => {})
  }
  return NextResponse.json(SUCCESS)
}
