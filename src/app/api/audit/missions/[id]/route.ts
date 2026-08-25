import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import {
  validateMissionInput, cleanMissionInput, transitionMissionAutorisee,
  synthetiserConstats, constatEnRetard, type MissionStatut,
} from '@/lib/audit'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

function peutEcrireAudit(role: UserRole): boolean {
  return role === 'AUDITEUR' || isAdminRole(role)
}

async function loadInScope(session: { user: { id: string; role?: string } }, id: string) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const mission = await prisma.auditMission.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true, statut: true },
  })
  if (!mission) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  const cfg = await getOrgConfig(mission.organizationId)
  if (!cfg.auditInterneActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  return { userId, userRole, mission }
}

// GET /api/audit/missions/[id] — détail + constats (avec « en retard » calculé).
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const c = await loadInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error

  const mission = await prisma.auditMission.findUnique({
    where: { id },
    include: {
      constats: {
        orderBy: [{ criticite: 'desc' }, { createdAt: 'asc' }],
        include: { riskItem: { select: { intitule: true } } },
      },
    },
  })
  if (!mission) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const now = new Date()
  const { constats, ...entete } = mission
  return NextResponse.json({
    mission: entete,
    constats: constats.map(({ riskItem, ...c2 }) => ({
      ...c2,
      riskIntitule: riskItem?.intitule ?? null,
      enRetard: constatEnRetard(c2, now),
    })),
    synthese: synthetiserConstats(constats, now),
  })
}

// PATCH /api/audit/missions/[id] — éditer ou faire transitionner la mission.
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const c = await loadInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error
  if (!peutEcrireAudit(c.userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const depuis = c.mission.statut as MissionStatut
  const vers = (typeof body.statut === 'string' ? body.statut : depuis) as MissionStatut
  if (!transitionMissionAutorisee(depuis, vers)) {
    return NextResponse.json({ error: 'transition_interdite' }, { status: 400 })
  }
  const erreur = validateMissionInput(body, { partial: true })
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanMissionInput(body)

  const partiel = Object.fromEntries(
    (Object.keys(data) as (keyof typeof data)[]).filter(k => k in body).map(k => [k, data[k]]),
  ) as Partial<typeof data>

  const updated = await prisma.auditMission.update({
    where: { id },
    data: {
      ...partiel,
      ...('programmeResultats' in partiel ? { programmeResultats: partiel.programmeResultats as unknown as object } : {}),
      ...(vers !== depuis ? { statut: vers } : {}),
    },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.mission.organizationId, ip: getClientIp(req),
    details: { scope: 'audit-mission', action: vers !== depuis ? `transition:${depuis}->${vers}` : 'update', id },
  })
  return NextResponse.json(updated)
}

// DELETE /api/audit/missions/[id] — supprimer une mission et ses constats.
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const c = await loadInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return c.error
  if (!peutEcrireAudit(c.userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  await prisma.auditMission.delete({ where: { id } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole, organizationId: c.mission.organizationId, ip: getClientIp(req),
    details: { scope: 'audit-mission', action: 'delete', id },
  })
  return NextResponse.json({ ok: true })
}
