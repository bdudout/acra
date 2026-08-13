import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { validateMissionInput, cleanMissionInput, synthetiserConstats } from '@/lib/audit'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Cloisonnement 3ᵉ ligne : SEUL l'auditeur écrit les objets d'audit (l'admin
 * aussi, pour l'administration). Tous les autres rôles consultent uniquement.
 */
export function peutEcrireAudit(role: UserRole): boolean {
  return role === 'AUDITEUR' || isAdminRole(role)
}

async function ctx(session: { user: { id: string; role?: string } }) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  return { userId, userRole, orgId: scope.activeOrgId }
}

// GET /api/audit/missions — plan d'audit de l'organisation active + synthèse des constats.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!orgId) return NextResponse.json({ missions: [], active: false })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.auditInterneActive) return NextResponse.json({ missions: [], active: false })

  const rows = await prisma.auditMission.findMany({
    where: { organizationId: orgId },
    orderBy: [{ createdAt: 'desc' }],
    include: { constats: { select: { criticite: true, statut: true, echeance: true } } },
  })
  const now = new Date()
  const missions = rows.map(({ constats, ...m }) => ({
    ...m,
    synthese: synthetiserConstats(constats, now),
  }))
  return NextResponse.json({ missions, active: true })
}

// POST /api/audit/missions — planifier une mission (auditeur / admin).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!peutEcrireAudit(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  const cfg = await getOrgConfig(orgId)
  if (!cfg.auditInterneActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const erreur = validateMissionInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanMissionInput(body)

  const mission = await prisma.auditMission.create({ data: { ...data, organizationId: orgId, statut: 'PLANIFIEE' } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'audit-mission', action: 'create', id: mission.id },
  })
  return NextResponse.json(mission, { status: 201 })
}
