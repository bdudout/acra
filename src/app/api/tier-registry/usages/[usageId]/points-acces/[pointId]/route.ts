import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { tierContext } from '@/lib/tier-registry.server'
import { lirePointAcces } from '@/lib/tier-endpoints'

export const dynamic = 'force-dynamic'
type P = { params: Promise<{ usageId: string; pointId: string }> }

/** Point d'accès de l'usage indiqué ET de l'organisation active ; sinon 404 sans divulgation. */
async function charger(usageId: string, pointId: string, orgId: string) {
  const point = await prisma.tierUsageEndpoint.findUnique({ where: { id: pointId }, select: { id: true, usageId: true, organizationId: true } })
  return point && point.usageId === usageId && point.organizationId === orgId ? point : null
}

/** Remplace un point d'accès (gestionnaires du registre TIC de l'organisation active). */
export async function PUT(req: NextRequest, { params }: P) {
  const got = await tierContext({ write: 'manage' }); if ('error' in got) return got.error
  const { ctx } = got
  const { usageId, pointId } = await params
  const lu = lirePointAcces(await req.json().catch(() => ({})))
  if (!lu.ok) return NextResponse.json({ error: lu.error }, { status: 400 })
  if (!(await charger(usageId, pointId, ctx.orgId))) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const point = await prisma.tierUsageEndpoint.update({ where: { id: pointId }, data: lu.data })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'tier-registry', action: 'point-acces-update', usageId, pointId, hote: lu.data.hote } })
  return NextResponse.json(point)
}

/** Supprime un point d'accès (gestionnaires du registre TIC de l'organisation active). */
export async function DELETE(req: NextRequest, { params }: P) {
  const got = await tierContext({ write: 'manage' }); if ('error' in got) return got.error
  const { ctx } = got
  const { usageId, pointId } = await params
  if (!(await charger(usageId, pointId, ctx.orgId))) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  await prisma.tierUsageEndpoint.delete({ where: { id: pointId } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'tier-registry', action: 'point-acces-delete', usageId, pointId } })
  return NextResponse.json({ ok: true })
}
