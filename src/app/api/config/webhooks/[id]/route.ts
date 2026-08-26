import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

async function ctx(session: { user: { id: string; role?: string } }) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  return { userId, userRole: scope.role, orgId: scope.activeOrgId }
}

// PATCH /api/config/webhooks/[id] — active/désactive un webhook (ADMIN).
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!isAdminRole(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })

  const { id } = await params
  const existing = await prisma.webhook.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  if (typeof body.actif !== 'boolean') return NextResponse.json({ error: 'actif_requis' }, { status: 400 })

  const updated = await prisma.webhook.update({
    where: { id },
    data: { actif: body.actif },
    select: { id: true, name: true, url: true, events: true, actif: true, createdAt: true },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'webhook', action: body.actif ? 'enable' : 'disable', id },
  })
  return NextResponse.json(updated)
}

// DELETE /api/config/webhooks/[id] — supprime un webhook (ADMIN).
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!isAdminRole(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })

  const { id } = await params
  const existing = await prisma.webhook.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  await prisma.webhook.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'webhook', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
}
