import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { peutGererRegistreTic, type UserRole } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * Rattache (ou détache, `tierId: null`) un arrangement TIC à une identité de tiers. Le tiers doit être autorisé pour l'organisation
 * de l'arrangement ; le nom historique du prestataire est conservé (instantané), jamais réécrit.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'organization_required' }, { status: 400 })
  if (!peutGererRegistreTic(scope.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const rl = await rateLimit(`tier-registry:${userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })

  const body = await req.json().catch(() => ({}))
  const arrangementId = typeof body.arrangementId === 'string' ? body.arrangementId : ''
  const tierId = typeof body.tierId === 'string' && body.tierId ? body.tierId : null
  if (!arrangementId) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })

  const arrangement = await prisma.arrangementTic.findFirst({ where: { id: arrangementId, organizationId: orgId }, select: { id: true, tierId: true } })
  if (!arrangement) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (tierId) {
    const access = await prisma.tierOrganization.findUnique({ where: { tierId_organizationId: { tierId, organizationId: orgId } }, select: { tierId: true } })
    if (!access) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  await prisma.arrangementTic.update({ where: { id: arrangement.id }, data: { tierId } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId, userRole: scope.role, organizationId: orgId, ip: getClientIp(req), details: { scope: 'tier-registry', action: tierId ? 'link' : 'unlink', arrangementId: arrangement.id, from: arrangement.tierId, to: tierId } })
  return NextResponse.json({ ok: true, tierId })
}
