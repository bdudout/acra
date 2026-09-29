import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { resolveIncidentsConfig, sanitizeIncidentsConfig } from '@/lib/incidents-config'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function contexte() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  return { userId, role: scope.role as UserRole, orgId: scope.activeOrgId }
}

// GET /api/incidents/config — configuration effective (défauts + surcharges de l'org).
export async function GET(): Promise<NextResponse> {
  const c = await contexte()
  if ('error' in c) return c.error as NextResponse
  if (!c.orgId) return NextResponse.json({ active: false })
  const cfg = await getOrgConfig(c.orgId)
  if (!cfg.incidentsActive) return NextResponse.json({ active: false })
  return NextResponse.json({ active: true, canEdit: isAdminRole(c.role), config: resolveIncidentsConfig(cfg.incidentsConfig) })
}

// PUT /api/incidents/config — régimes, devise/taux, seuils, catalogues (ADMIN de l'organisation).
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const c = await contexte()
  if ('error' in c) return c.error as NextResponse
  if (!c.orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  const cfg = await getOrgConfig(c.orgId)
  if (!cfg.incidentsActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  if (!isAdminRole(c.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const incidentsConfig = sanitizeIncidentsConfig(body)
  const json = incidentsConfig as unknown as Prisma.InputJsonValue
  await prisma.organizationConfig.upsert({
    where: { id: c.orgId },
    create: { id: c.orgId, incidentsConfig: json },
    update: { incidentsConfig: json },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.role, organizationId: c.orgId, targetId: c.orgId, targetType: 'organization', ip: getClientIp(req),
    details: { scope: 'incidents-config' },
  })
  return NextResponse.json({ config: resolveIncidentsConfig(incidentsConfig) })
}
