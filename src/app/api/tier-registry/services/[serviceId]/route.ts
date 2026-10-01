import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { tierContext, tierGranted } from '@/lib/tier-registry.server'
import { cleanServiceInput } from '@/lib/tier-offers'

export const dynamic = 'force-dynamic'

/** Renomme, recatégorise ou désactive une offre (jamais supprimée : les usages et contrats y restent rattachés). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ serviceId: string }> }) {
  const got = await tierContext({ write: 'manage' }); if ('error' in got) return got.error
  const { ctx } = got
  const { serviceId } = await params
  const service = await prisma.tierService.findUnique({ where: { id: serviceId }, select: { id: true, tierId: true, nom: true, typeService: true, description: true } })
  if (!service || !(await tierGranted(service.tierId, ctx.orgId))) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const data: { nom?: string; typeService?: string; description?: string | null; actif?: boolean } = {}
  if ('nom' in body || 'typeService' in body || 'description' in body) {
    const cleaned = cleanServiceInput({ nom: body.nom ?? service.nom, typeService: body.typeService ?? service.typeService, description: 'description' in body ? body.description : service.description })
    if (!cleaned.ok) return NextResponse.json({ error: cleaned.error }, { status: 400 })
    Object.assign(data, cleaned.value)
  }
  if (typeof body.actif === 'boolean') data.actif = body.actif
  if (!Object.keys(data).length) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  const updated = await prisma.tierService.update({ where: { id: serviceId }, data })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'tier-registry', action: 'service-update', serviceId, fields: Object.keys(data) } })
  return NextResponse.json(updated)
}
