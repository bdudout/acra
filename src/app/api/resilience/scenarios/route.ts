import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutGererRegistreTic } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { lireScenario } from '@/lib/scenarios-severes'

export const dynamic = 'force-dynamic'

/** POST /api/resilience/scenarios — ajoute un scénario « sévère mais plausible » à un processus de l'organisation active. */
export const POST = withAccess({ org: 'active', allow: peutGererRegistreTic, rateLimit: { bucket: 'scenarios-severes' } }, async (req, { user, role, orgId }) => {
  if (!(await getOrgConfig(orgId)).reglementaireActive) return NextResponse.json({ error: 'module_inactive' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const lu = lireScenario(body)
  if (!lu.ok) return NextResponse.json({ error: lu.error }, { status: 400 })
  const processusId = typeof body.processusId === 'string' ? body.processusId : ''
  const p = processusId ? await prisma.processus.findFirst({ where: { id: processusId, organizationId: orgId }, select: { id: true } }) : null
  if (!p) return NextResponse.json({ error: 'processus_introuvable' }, { status: 404 })
  const sc = await prisma.scenarioSevere.create({ data: { organizationId: orgId, processusId: p.id, createdById: user.id, ...lu.data } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), details: { scope: 'resilience', action: 'scenario-create', id: sc.id, processusId: p.id } })
  return NextResponse.json(sc, { status: 201 })
})
