import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { ACTIVE_ORG_COOKIE, resolveOrgContext, getAccessibleOrgIds, getAnalyseScope } from '@/lib/org-context.server'
import { requireSession } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'

// orgId vide ⇒ retour à la vue par défaut (toutes organisations pour un super-admin).
const schema = z.object({ orgId: z.string().max(40) })

/**
 * GET /api/org/active — organisations sélectionnables par l'utilisateur + org active.
 * Pour un SUPER_ADMIN : toutes les organisations. Sinon : ses appartenances.
 */
export async function GET() {
  const g = await requireSession()
  if (g.error) return g.error

  const userId = g.user.id
  const role = g.user.role

  const ctx = await resolveOrgContext(userId, role)

  // Options = organisations ACCESSIBLES (sous-arbre inclus pour un membre « groupe »
  // SUBTREE → drill-down), triées par chemin (ordre hiérarchique) avec `path`/`logo`.
  const { all, ids } = await getAccessibleOrgIds(userId, role)
  const where = all ? {} : { id: { in: ids } }
  const options = await prisma.organization.findMany({
    where, select: { id: true, nom: true, path: true, logo: true }, orderBy: { path: 'asc' },
  })

  // Rôle EFFECTIF dans l'organisation active (celui qu'appliquent les API), pour que l'interface affiche les mêmes options.
  const scope = await getAnalyseScope(userId, role)
  // canSelectAll : le super-admin peut revenir à la vue « toutes organisations ».
  return NextResponse.json({ activeOrgId: ctx.activeOrgId, activeRole: scope.activeOrgId ? scope.role : (role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null), options, canSelectAll: role === 'SUPER_ADMIN' })
}

/**
 * POST /api/org/active — change l'organisation active (cookie `acra_org`).
 * Sécurité : l'organisation doit être une appartenance de l'utilisateur
 * (ou n'importe quelle organisation pour un SUPER_ADMIN).
 */
export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'org-active' }, body: schema }, async (_req, { user, body: { orgId } }) => {
  const userId = user.id
  const role = user.role

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
})
