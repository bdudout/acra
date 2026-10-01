// ─── Invitation à rejoindre une organisation (T23) ───────────────────────────
// GET  : aperçu (organisation, rôle, compte existant ?) pour la page d'acceptation.
// POST : acceptation. Connecté → l'e-mail doit être celui de l'invitation. Sans
//        session → { name, password } crée le compte, seulement si aucun compte
//        n'existe pour cet e-mail. Route publique (cf. lib/public-paths) : le jeton
//        (256 bits, haché en base, usage unique, 7 jours) fait office d'autorisation.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sessionUser } from '@/lib/route-guard.server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { previewInvitation, acceptInvitation } from '@/lib/org-invitation.server'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ token: string }> }

const LIMIT = { limit: 30, windowMs: 15 * 60 * 1000 }
const tokenOk = (t: string) => /^[A-Za-z0-9_-]{20,100}$/.test(t)

async function throttled(req: NextRequest) {
  const rl = await rateLimit(`invitation:${getClientIp(req)}`, LIMIT.limit, LIMIT.windowMs)
  return rl.allowed ? null : NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
}

export async function GET(req: NextRequest, { params }: Params) {
  const limited = await throttled(req)
  if (limited) return limited
  const { token } = await params
  if (!tokenOk(token)) return NextResponse.json({ state: 'NOT_FOUND' }, { status: 404 })
  const preview = await previewInvitation(token)
  return NextResponse.json(preview, { status: preview.state === 'NOT_FOUND' ? 404 : 200 })
}

const newAccountSchema = z.object({ name: z.string().max(100), password: z.string().min(1).max(200) })

export async function POST(req: NextRequest, { params }: Params) {
  const limited = await throttled(req)
  if (limited) return limited
  const { token } = await params
  if (!tokenOk(token)) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const user = sessionUser(await getServerSession(authOptions))
  const body = await req.json().catch(() => ({}))
  const parsed = newAccountSchema.safeParse(body)
  const result = await acceptInvitation(
    token,
    user ? { userId: user.id, email: user.email } : null,
    !user && parsed.success ? parsed.data : undefined,
    getClientIp(req),
  )
  if (!result.ok) return NextResponse.json({ error: result.code }, { status: result.status })
  return NextResponse.json({ ok: true, organizationId: result.organizationId })
}
