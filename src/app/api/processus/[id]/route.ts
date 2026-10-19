import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope, roleSurRessource } from '@/lib/org-context.server'
import { isAdminRole } from '@/lib/permissions'
import type { SessionUser } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'
import { validateProcessusInput, cleanProcessus, wouldCreateCycle } from '@/lib/processus'
import { sanitizeDateRevue } from '@/lib/revues'
import { auditLog, getClientIp } from '@/lib/logger'

// Charge le processus en s'assurant qu'il appartient au périmètre de l'utilisateur (ADMIN).
// org: 'none' — le processus est cherché dans tout le périmètre visible (pas d'organisation active exigée).
async function loadInScope(user: SessionUser, id: string) {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const p = await prisma.processus.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true },
  })
  if (!p) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  // Rôle EFFECTIF dans l'organisation DE LA RESSOURCE, jamais celui de l'org active (CWE-863).
  const userRole = await roleSurRessource(userId, user.role, p.organizationId)
  if (!isAdminRole(userRole)) return { error: NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 }) }
  return { error: null, userId, userRole, orgId: p.organizationId }
}

// PATCH /api/processus/[id] — modifier (ADMIN). Vérifie l'absence de cycle sur re-parentage.
export const PATCH = withAccess({ org: 'none', rateLimit: { bucket: 'processus' } }, async (req, { user, params: { id } }) => {
  const ctx = await loadInScope(user, id)
  if (ctx.error) return ctx.error

  const body = await req.json().catch(() => ({}))
  const erreur = validateProcessusInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanProcessus(body)

  if (data.parentId) {
    // Parent dans la même organisation + pas de cycle.
    const parent = await prisma.processus.findFirst({ where: { id: data.parentId, organizationId: ctx.orgId }, select: { id: true } })
    if (!parent) return NextResponse.json({ error: 'parent_invalide' }, { status: 400 })
    const all = await prisma.processus.findMany({ where: { organizationId: ctx.orgId }, select: { id: true, parentId: true } })
    if (wouldCreateCycle(all, id, data.parentId)) return NextResponse.json({ error: 'cycle' }, { status: 400 })
  }
  // Revue périodique du BIA (lib/revues) : date de dernière revue ; invalide ou future → ignorée.
  const derniereRevue = sanitizeDateRevue((body as { derniereRevue?: unknown }).derniereRevue, new Date())
  const updated = await prisma.processus.update({ where: { id }, data: { ...data, ...(derniereRevue !== undefined ? { derniereRevue } : {}) } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.userRole, ip: getClientIp(req), details: { scope: 'processus', action: 'update', id } })
  return NextResponse.json(updated)
})

// DELETE /api/processus/[id] — supprimer (ADMIN). Les enfants sont détachés (parent → null).
export const DELETE = withAccess({ org: 'none', rateLimit: { bucket: 'processus' } }, async (req, { user, params: { id } }) => {
  const ctx = await loadInScope(user, id)
  if (ctx.error) return ctx.error
  await prisma.processus.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.userRole, ip: getClientIp(req), details: { scope: 'processus', action: 'delete', id } })
  return NextResponse.json({ ok: true })
})
