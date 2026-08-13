import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { validateConstatInput, cleanConstatInput } from '@/lib/audit'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

function peutEcrireAudit(role: UserRole): boolean {
  return role === 'AUDITEUR' || isAdminRole(role)
}

// POST /api/audit/missions/[id]/constats — ajouter un constat (auditeur / admin).
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const { id } = await params
  const scope = await getAnalyseScope(userId, instanceRole)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  if (!peutEcrireAudit(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const mission = await prisma.auditMission.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true },
  })
  if (!mission) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const cfg = await getOrgConfig(mission.organizationId)
  if (!cfg.auditInterneActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateConstatInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanConstatInput(body)

  if (data.riskItemId) {
    const r = await prisma.riskItem.findFirst({ where: { id: data.riskItemId, organizationId: mission.organizationId }, select: { id: true } })
    if (!r) return NextResponse.json({ error: 'risque_invalide' }, { status: 400 })
  }

  const constat = await prisma.auditConstat.create({
    data: { ...data, missionId: id, organizationId: mission.organizationId },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: mission.organizationId, ip: getClientIp(req),
    details: { scope: 'audit-constat', action: 'create', missionId: id, id: constat.id },
  })
  return NextResponse.json(constat, { status: 201 })
}
