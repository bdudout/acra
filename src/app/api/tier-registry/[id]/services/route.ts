import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { tierContext, tierGranted } from '@/lib/tier-registry.server'
import { cleanServiceInput } from '@/lib/tier-offers'

export const dynamic = 'force-dynamic'

/** Ajoute une offre à un tiers autorisé (ADMIN ou 2ᵉ ligne). La catégorie n'est jamais une clé d'unicité. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const got = await tierContext({ write: 'manage' }); if ('error' in got) return got.error
  const { ctx } = got
  const { id } = await params
  if (!(await tierGranted(id, ctx.orgId))) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const cleaned = cleanServiceInput(await req.json().catch(() => ({})))
  if (!cleaned.ok) return NextResponse.json({ error: cleaned.error }, { status: 400 })
  const service = await prisma.tierService.create({ data: { tierId: id, ...cleaned.value } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'tier-registry', action: 'service-create', tierId: id, serviceId: service.id, nom: cleaned.value.nom } })
  return NextResponse.json(service, { status: 201 })
}
