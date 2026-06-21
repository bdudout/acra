import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { ACTIVE_ORG_COOKIE } from '@/lib/org-context.server'

const schema = z.object({ orgId: z.string().min(1).max(40) })

/**
 * POST /api/org/active — change l'organisation active (cookie `acra_org`).
 * Sécurité : l'organisation doit être une appartenance de l'utilisateur
 * (ou n'importe quelle organisation pour un SUPER_ADMIN).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId = (session.user as any).id as string
  const role = (session.user as any).role ?? 'ANALYSTE'

  let orgId: string
  try {
    orgId = schema.parse(await req.json()).orgId
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  // Validation du périmètre.
  const allowed =
    role === 'SUPER_ADMIN'
      ? !!(await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } }))
      : !!(await prisma.orgMembership.findUnique({
          where: { userId_organizationId: { userId, organizationId: orgId } },
          select: { id: true },
        }))

  if (!allowed) return NextResponse.json({ error: 'Organisation non autorisée' }, { status: 403 })

  const res = NextResponse.json({ ok: true, orgId })
  res.cookies.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365,
  })
  return res
}
