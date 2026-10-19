import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { peutGererRegistreTic } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Rattache (ou détache, `tierId: null`) un arrangement TIC à une identité de tiers. Le tiers doit être autorisé pour l'organisation
 * de l'arrangement ; le nom historique du prestataire est conservé (instantané), jamais réécrit.
 */
export const POST = withAccess({ org: 'active', allow: peutGererRegistreTic, rateLimit: { bucket: 'tier-registry' } }, async (req, { user, role, orgId }) => {
  const userId = user.id

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
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId, userRole: role, organizationId: orgId, ip: getClientIp(req), details: { scope: 'tier-registry', action: tierId ? 'link' : 'unlink', arrangementId: arrangement.id, from: arrangement.tierId, to: tierId } })
  return NextResponse.json({ ok: true, tierId })
})
