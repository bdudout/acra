import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig, upsertOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { sanitizeRelancesConfig } from '@/lib/relances'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function contexte() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId || !scope.role) return { error: NextResponse.json({ error: 'organization_required' }, { status: 400 }) }
  return { userId, role: scope.role as UserRole, orgId: scope.activeOrgId }
}

// GET /api/relances/config — paramétrage effectif des relances (questionnaires, préconisations, plans d'action).
export async function GET(): Promise<NextResponse> {
  const c = await contexte()
  if ('error' in c) return c.error as NextResponse
  const cfg = await getOrgConfig(c.orgId)
  return NextResponse.json({ canEdit: isAdminRole(c.role), config: sanitizeRelancesConfig(cfg.relancesConfig) })
}

// PUT /api/relances/config — ADMIN de l'organisation (rôle effectif) uniquement.
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const c = await contexte()
  if ('error' in c) return c.error as NextResponse
  if (!isAdminRole(c.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const config = sanitizeRelancesConfig(await req.json().catch(() => null))
  const json = config as unknown as Prisma.InputJsonValue
  await upsertOrgConfig(c.orgId, { relancesConfig: json })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), details: { scope: 'relances', action: 'config', ...config } })
  return NextResponse.json({ config })
}
