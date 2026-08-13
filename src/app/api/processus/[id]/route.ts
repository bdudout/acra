import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { validateProcessusInput, cleanProcessus, wouldCreateCycle } from '@/lib/processus'
import { auditLog, getClientIp } from '@/lib/logger'

type Params = { params: Promise<{ id: string }> }

// Charge le processus en s'assurant qu'il appartient au périmètre de l'utilisateur (ADMIN).
async function loadInScope(session: { user: { id: string; role?: string } }, id: string) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  if (!isAdminRole(userRole)) return { error: NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 }) }
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const p = await prisma.processus.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true },
  })
  if (!p) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  return { userId, userRole, orgId: p.organizationId }
}

// PATCH /api/processus/[id] — modifier (ADMIN). Vérifie l'absence de cycle sur re-parentage.
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const ctx = await loadInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in ctx) return ctx.error

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
  const updated = await prisma.processus.update({ where: { id }, data })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.userRole, ip: getClientIp(req), details: { scope: 'processus', action: 'update', id } })
  return NextResponse.json(updated)
}

// DELETE /api/processus/[id] — supprimer (ADMIN). Les enfants sont détachés (parent → null).
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const ctx = await loadInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in ctx) return ctx.error
  await prisma.processus.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.userRole, ip: getClientIp(req), details: { scope: 'processus', action: 'delete', id } })
  return NextResponse.json({ ok: true })
}
