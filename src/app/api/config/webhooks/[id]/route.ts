import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminRole } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const access = { org: 'active', allow: isAdminRole, rateLimit: { bucket: 'webhooks' } } as const

// PATCH /api/config/webhooks/[id] — active/désactive un webhook (ADMIN).
export const PATCH = withAccess(access, async (req, { user, role: userRole, orgId, params: { id } }) => {
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
    userId: user.id, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'webhook', action: body.actif ? 'enable' : 'disable', id },
  })
  return NextResponse.json(updated)
})

// DELETE /api/config/webhooks/[id] — supprime un webhook (ADMIN).
export const DELETE = withAccess(access, async (req, { user, role: userRole, orgId, params: { id } }) => {
  const existing = await prisma.webhook.findFirst({ where: { id, organizationId: orgId } })
  if (!existing) return NextResponse.json({ error: 'introuvable' }, { status: 404 })

  await prisma.webhook.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: user.id, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'webhook', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
})
