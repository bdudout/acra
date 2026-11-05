import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { peutGererRegistreTic } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { lireScenario } from '@/lib/scenarios-severes'

export const dynamic = 'force-dynamic'
const acces = { org: 'active', allow: peutGererRegistreTic, rateLimit: { bucket: 'scenarios-severes' } } as const
/** Scénario de l'organisation active, sinon 404 sans divulgation. */
const charger = (id: string, orgId: string) => prisma.scenarioSevere.findFirst({ where: { id, organizationId: orgId }, select: { id: true } })

/** PUT /api/resilience/scenarios/[id] — remplace le scénario. */
export const PUT = withAccess(acces, async (req, { user, role, orgId, params }) => {
  const lu = lireScenario(await req.json().catch(() => ({})) as Record<string, unknown>)
  if (!lu.ok) return NextResponse.json({ error: lu.error }, { status: 400 })
  if (!(await charger(params.id, orgId))) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const sc = await prisma.scenarioSevere.update({ where: { id: params.id }, data: lu.data })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), details: { scope: 'resilience', action: 'scenario-update', id: sc.id } })
  return NextResponse.json(sc)
})

/** DELETE /api/resilience/scenarios/[id] — supprime le scénario. */
export const DELETE = withAccess(acces, async (req, { user, role, orgId, params }) => {
  if (!(await charger(params.id, orgId))) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  await prisma.scenarioSevere.delete({ where: { id: params.id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), details: { scope: 'resilience', action: 'scenario-delete', id: params.id } })
  return NextResponse.json({ ok: true })
})
