import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { tierContext } from '@/lib/tier-registry.server'

export const dynamic = 'force-dynamic'

/** Supprime un usage DE L'ORGANISATION ACTIVE (ADMIN, comme sa création). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ usageId: string }> }) {
  const got = await tierContext({ write: 'admin' }); if ('error' in got) return got.error
  const { ctx } = got
  const { usageId } = await params
  const usage = await prisma.tierServiceUsage.findUnique({ where: { id: usageId }, select: { id: true, organizationId: true } })
  if (!usage || usage.organizationId !== ctx.orgId) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  await prisma.tierServiceUsage.delete({ where: { id: usageId } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'tier-registry', action: 'usage-delete', usageId } })
  return NextResponse.json({ ok: true })
}
