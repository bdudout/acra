import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import type { UserRole } from '@/lib/permissions'
import { peutEcrireAudit } from '@/lib/audit-acces'
import { cleanUniversInput } from '@/lib/audit-l4'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

async function charger(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const entree = await prisma.auditUnivers.findFirst({ where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) }, select: { id: true, organizationId: true } })
  if (!entree) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  if (!(await getOrgConfig(entree.organizationId)).auditInterneActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  const role = scope.role as UserRole
  if (!peutEcrireAudit(role)) return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  return { userId, role, entree }
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const c = await charger(id)
  if ('error' in c) return c.error as NextResponse
  const body = await req.json().catch(() => ({}))
  const data = cleanUniversInput(body)
  if (!data.intitule) return NextResponse.json({ error: 'intitule_requis' }, { status: 400 })
  if (data.processusId && !(await prisma.processus.findFirst({ where: { id: data.processusId, organizationId: c.entree.organizationId }, select: { id: true } }))) {
    return NextResponse.json({ error: 'processus_invalide' }, { status: 400 })
  }
  const updated = await prisma.auditUnivers.update({ where: { id }, data })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.entree.organizationId, ip: getClientIp(req), details: { scope: 'audit', action: 'univers:update', id } })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const c = await charger(id)
  if ('error' in c) return c.error as NextResponse
  await prisma.auditUnivers.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.entree.organizationId, ip: getClientIp(req), details: { scope: 'audit', action: 'univers:delete', id } })
  return NextResponse.json({ ok: true })
}
