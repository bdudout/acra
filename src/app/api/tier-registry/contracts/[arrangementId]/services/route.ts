import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { tierContext } from '@/lib/tier-registry.server'
import { planCoverageChange } from '@/lib/tier-offers'

export const dynamic = 'force-dynamic'

/**
 * Définit les offres couvertes par un contrat DE L'ORGANISATION (lié à un tiers). Seules les offres du tiers du contrat sont admises ;
 * retirer une offre encore utilisée par des usages est refusé (409), jamais un usage silencieusement décroché.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ arrangementId: string }> }) {
  const got = await tierContext({ write: 'manage' }); if ('error' in got) return got.error
  const { ctx } = got
  const { arrangementId } = await params
  const arrangement = await prisma.arrangementTic.findFirst({ where: { id: arrangementId, organizationId: ctx.orgId }, select: { id: true, tierId: true } })
  if (!arrangement?.tierId) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const requested: string[] = Array.isArray(body.serviceIds) ? body.serviceIds.filter((x: unknown): x is string => typeof x === 'string').slice(0, 100) : []
  const offers = await prisma.tierService.findMany({ where: { tierId: arrangement.tierId }, select: { id: true } })
  const offerIds = new Set(offers.map(o => o.id))
  if (requested.some(id => !offerIds.has(id))) return NextResponse.json({ error: 'service_not_of_tier' }, { status: 400 })

  const result = await prisma.$transaction(async tx => {
    const current = await tx.tierContractService.findMany({ where: { arrangementId }, select: { id: true, tierServiceId: true } })
    const usage = await tx.tierServiceUsage.groupBy({ by: ['contractServiceId'], where: { contractServiceId: { in: current.map(c => c.id) } }, _count: { _all: true } })
    const byService: Record<string, number> = {}
    for (const row of usage) { const cs = current.find(c => c.id === row.contractServiceId); if (cs) byService[cs.tierServiceId] = row._count._all }
    const plan = planCoverageChange(current.map(c => c.tierServiceId), requested, byService)
    if (plan.blocked.length) return { blocked: plan.blocked }
    if (plan.toAdd.length) await tx.tierContractService.createMany({ data: plan.toAdd.map(tierServiceId => ({ arrangementId, tierServiceId })) })
    if (plan.toRemove.length) await tx.tierContractService.deleteMany({ where: { arrangementId, tierServiceId: { in: plan.toRemove } } })
    return { plan }
  })
  if ('blocked' in result) return NextResponse.json({ error: 'has_usages', blocked: result.blocked }, { status: 409 })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'tier-registry', action: 'contract-coverage', arrangementId, added: result.plan.toAdd.length, removed: result.plan.toRemove.length } })
  return NextResponse.json({ ok: true, added: result.plan.toAdd.length, removed: result.plan.toRemove.length })
}
