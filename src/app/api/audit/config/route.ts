import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig, upsertOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { resolveAuditConfig, sanitizeAuditConfig } from '@/lib/audit-config'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function contexte() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  return { userId, role: scope.role as UserRole, orgId: scope.activeOrgId }
}

// GET /api/audit/config — paramétrage effectif (rappels, cycles de couverture).
export async function GET(): Promise<NextResponse> {
  const c = await contexte()
  if ('error' in c) return c.error as NextResponse
  if (!c.orgId) return NextResponse.json({ active: false })
  const cfg = await getOrgConfig(c.orgId)
  if (!cfg.auditInterneActive) return NextResponse.json({ active: false })
  return NextResponse.json({ active: true, canEdit: isAdminRole(c.role), config: resolveAuditConfig(cfg.auditConfig) })
}

// PUT /api/audit/config — ADMIN de l'organisation uniquement.
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const c = await contexte()
  if ('error' in c) return c.error as NextResponse
  if (!c.orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  if (!(await getOrgConfig(c.orgId)).auditInterneActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  if (!isAdminRole(c.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const config = sanitizeAuditConfig(await req.json().catch(() => null))
  const json = config as unknown as Prisma.InputJsonValue
  await upsertOrgConfig(c.orgId, { auditConfig: json })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), details: { scope: 'audit', action: 'config' } })
  return NextResponse.json({ config })
}
