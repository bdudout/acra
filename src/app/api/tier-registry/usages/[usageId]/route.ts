import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { cleanUsageCriticality, cleanExpositionInternet } from '@/lib/tier-offers'
import { tierContext } from '@/lib/tier-registry.server'

export const dynamic = 'force-dynamic'

/** Supprime un usage DE L'ORGANISATION ACTIVE (gestionnaires du registre TIC, comme sa création). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ usageId: string }> }) {
  const got = await tierContext({ write: 'manage' }); if ('error' in got) return got.error
  const { ctx } = got
  const { usageId } = await params
  const usage = await prisma.tierServiceUsage.findUnique({ where: { id: usageId }, select: { id: true, organizationId: true } })
  if (!usage || usage.organizationId !== ctx.orgId) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  await prisma.tierServiceUsage.delete({ where: { id: usageId } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'tier-registry', action: 'usage-delete', usageId } })
  return NextResponse.json({ ok: true })
}

/**
 * Qualifie un usage DE L'ORGANISATION ACTIVE (gestionnaires du registre TIC) : criticité et / ou exposition à Internet.
 * Mise à jour partielle : seuls les champs présents changent ; vide = non renseigné.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ usageId: string }> }) {
  const got = await tierContext({ write: 'manage' }); if ('error' in got) return got.error
  const { ctx } = got
  const { usageId } = await params
  const body = await req.json().catch(() => ({}))
  const data: { criticite?: string | null; exposeInternet?: boolean | null } = {}
  if ('criticite' in body) {
    const crit = cleanUsageCriticality(body.criticite)
    if (!crit.ok) return NextResponse.json({ error: crit.error }, { status: 400 })
    data.criticite = crit.value
  }
  if ('exposeInternet' in body) {
    const expo = cleanExpositionInternet(body.exposeInternet)
    if (!expo.ok) return NextResponse.json({ error: expo.error }, { status: 400 })
    data.exposeInternet = expo.value
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: 'aucun_champ' }, { status: 400 })
  const usage = await prisma.tierServiceUsage.findUnique({ where: { id: usageId }, select: { id: true, organizationId: true } })
  if (!usage || usage.organizationId !== ctx.orgId) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  await prisma.tierServiceUsage.update({ where: { id: usageId }, data })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'tier-registry', action: 'usage-qualification', usageId, ...data } })
  return NextResponse.json({ ok: true, ...data })
}
