import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { ACTIVE_ORG_COOKIE, resolveOrgContext, getAccessibleOrgIds } from '@/lib/org-context.server'

// orgId vide ⇒ retour à la vue par défaut (toutes organisations pour un super-admin).
const schema = z.object({ orgId: z.string().max(40) })

/**
 * GET /api/org/active — organisations sélectionnables par l'utilisateur + org active.
 * Pour un SUPER_ADMIN : toutes les organisations. Sinon : ses appartenances.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId = (session.user as any).id as string
  const role = (session.user as any).role ?? 'ANALYSTE'

  const ctx = await resolveOrgContext(userId, role)

  // Options = organisations ACCESSIBLES (sous-arbre inclus pour un membre « groupe »
  // SUBTREE → drill-down), triées par chemin (ordre hiérarchique) avec `path`/`logo`.
  const { all, ids } = await getAccessibleOrgIds(userId, role)
  const where = all ? {} : { id: { in: ids } }
  const options = await prisma.organization.findMany({
    where, select: { id: true, nom: true, path: true, logo: true }, orderBy: { path: 'asc' },
  })

  // canSelectAll : le super-admin peut revenir à la vue « toutes organisations ».
  return NextResponse.json({ activeOrgId: ctx.activeOrgId, options, canSelectAll: role === 'SUPER_ADMIN' })
}

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

  // orgId vide ⇒ effacer la focalisation (retour vue par défaut / toutes orgs).
  if (orgId === '') {
    const res = NextResponse.json({ ok: true, orgId: '' })
    res.cookies.set(ACTIVE_ORG_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 })
    return res
  }

  // Validation du périmètre : l'organisation doit être ACCESSIBLE (sous-arbre inclus
  // pour un membre « groupe » SUBTREE → drill-down ; toute org pour un super-admin).
  const { all, ids } = await getAccessibleOrgIds(userId, role)
  const allowed = all
    ? !!(await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } }))
    : ids.includes(orgId)

  if (!allowed) return NextResponse.json({ error: 'Organisation non autorisée' }, { status: 403 })

  const res = NextResponse.json({ ok: true, orgId })
  res.cookies.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365,
  })
  return res
}
