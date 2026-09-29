import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import type { UserRole } from '@/lib/permissions'
import { peutEcrireAudit } from '@/lib/audit-acces'
import { cleanIndependance } from '@/lib/audit-l4'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// POST /api/audit/missions/[id]/independance — déclaration d'indépendance / de conflit d'intérêts,
// tracée (auteur, date). Réservé à l'audit.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  const role = scope.role as UserRole
  const { id } = await params
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const mission = await prisma.auditMission.findFirst({ where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) }, select: { id: true, organizationId: true } })
  if (!mission) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (!(await getOrgConfig(mission.organizationId)).auditInterneActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })
  if (!peutEcrireAudit(role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const decl = cleanIndependance(body, { auteur: userId, now: new Date() })
  if (!decl) return NextResponse.json({ error: 'commentaire_requis' }, { status: 400 })
  const updated = await prisma.auditMission.update({ where: { id }, data: { independance: decl as unknown as Prisma.InputJsonValue } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId, userRole: role, organizationId: mission.organizationId, ip: getClientIp(req), details: { scope: 'audit', action: 'independance', id, conflit: decl.conflit } })
  return NextResponse.json(updated)
}
