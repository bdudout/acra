import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig, upsertOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { peutLireRapports } from '@/lib/rapport-acces'
import { sanitizeRapportsConfig } from '@/lib/rapport-masquage'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function contexte() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return { error: NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 }) }
  return { userId, role: scope.role as UserRole, orgId: scope.activeOrgId }
}

// GET /api/rapports/config — gabarits surchargés (titre, introduction, sections masquées) de l'organisation.
export async function GET(): Promise<NextResponse> {
  const c = await contexte()
  if ('error' in c) return c.error as NextResponse
  if (!peutLireRapports(c.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const cfg = await getOrgConfig(c.orgId)
  if (!cfg.rapportsGrcActive) return NextResponse.json({ error: 'module_inactif' }, { status: 404 })
  return NextResponse.json({ canEdit: isAdminRole(c.role), config: sanitizeRapportsConfig(cfg.rapportsConfig) })
}

// PUT /api/rapports/config — ADMIN de l'organisation uniquement.
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const c = await contexte()
  if ('error' in c) return c.error as NextResponse
  if (!isAdminRole(c.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const config = sanitizeRapportsConfig(await req.json().catch(() => null))
  const json = config as unknown as Prisma.InputJsonValue
  await upsertOrgConfig(c.orgId, { rapportsConfig: json })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), details: { scope: 'rapport', action: 'config' } })
  return NextResponse.json({ config })
}
