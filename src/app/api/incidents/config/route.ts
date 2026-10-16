import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig, upsertOrgConfig } from '@/lib/org-config.server'
import { isAdminRole } from '@/lib/permissions'
import { requireSession } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'
import { resolveIncidentsConfig, sanitizeIncidentsConfig } from '@/lib/incidents-config'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET /api/incidents/config — configuration effective (défauts + surcharges de l'org).
// Sans organisation active : { active: false } (pas de 400) → requireSession.
export async function GET(): Promise<NextResponse> {
  const g = await requireSession()
  if (g.error) return g.error
  const scope = await getAnalyseScope(g.user.id, g.user.role)
  if (!scope.activeOrgId) return NextResponse.json({ active: false })
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.incidentsActive) return NextResponse.json({ active: false })
  return NextResponse.json({ active: true, canEdit: isAdminRole(scope.role), config: resolveIncidentsConfig(cfg.incidentsConfig) })
}

// PUT /api/incidents/config — régimes, devise/taux, seuils, catalogues (ADMIN de l'organisation).
export const PUT = withAccess({ org: 'active', allow: isAdminRole, rateLimit: { bucket: 'incidents-config' } }, async (req, { user, role, orgId }) => {
  const cfg = await getOrgConfig(orgId)
  if (!cfg.incidentsActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const incidentsConfig = sanitizeIncidentsConfig(body)
  const json = incidentsConfig as unknown as Prisma.InputJsonValue
  await upsertOrgConfig(orgId, { incidentsConfig: json })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: user.id, userRole: role, organizationId: orgId, targetId: orgId, targetType: 'organization', ip: getClientIp(req),
    details: { scope: 'incidents-config' },
  })
  return NextResponse.json({ config: resolveIncidentsConfig(incidentsConfig) })
})
