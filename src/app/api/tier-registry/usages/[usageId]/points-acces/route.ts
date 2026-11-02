import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { tierContext } from '@/lib/tier-registry.server'
import { lirePointAcces } from '@/lib/tier-endpoints'

export const dynamic = 'force-dynamic'
/** Plafond par usage : la cartographie reste lisible et la saisie ne peut pas être détournée en stockage. */
export const MAX_POINTS_PAR_USAGE = 50

/**
 * Ajoute un point d'accès (URL / hôte) à un usage DE L'ORGANISATION ACTIVE (gestionnaires du registre TIC).
 * Cartographie déclarative : l'adresse n'est jamais contactée par ACRA.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ usageId: string }> }) {
  const got = await tierContext({ write: 'manage' }); if ('error' in got) return got.error
  const { ctx } = got
  const { usageId } = await params
  const lu = lirePointAcces(await req.json().catch(() => ({})))
  if (!lu.ok) return NextResponse.json({ error: lu.error }, { status: 400 })
  const usage = await prisma.tierServiceUsage.findUnique({ where: { id: usageId }, select: { id: true, organizationId: true } })
  if (!usage || usage.organizationId !== ctx.orgId) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (await prisma.tierUsageEndpoint.count({ where: { usageId } }) >= MAX_POINTS_PAR_USAGE) return NextResponse.json({ error: 'trop_de_points' }, { status: 409 })
  const point = await prisma.tierUsageEndpoint.create({ data: { usageId, organizationId: usage.organizationId, ...lu.data } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'tier-registry', action: 'point-acces-create', usageId, pointId: point.id, hote: point.hote } })
  return NextResponse.json(point, { status: 201 })
}
