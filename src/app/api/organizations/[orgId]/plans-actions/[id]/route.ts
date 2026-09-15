/**
 * Un plan d'action : mise à jour (champs + ajout/retrait de liens) et suppression.
 * Réservé aux rôles de gouvernance.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { cleanPriorite, RISK_ACTION_STATUTS } from '@/lib/risk-action'
import { sanitizeLien } from '@/lib/plan-action'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ orgId: string; id: string }> }

function canManage(role: UserRole): boolean {
  return isAdminRole(role) || role === 'RSSI' || role === 'RISK_MANAGER' || role === 'DIRECTION_METIER'
}

async function guard(orgId: string, id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const role = await getEffectiveRoleForOrg(userId, instanceRole, orgId)
  if (!role || !canManage(role)) return { error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  const row = await prisma.planAction.findFirst({ where: { id, organizationId: orgId }, select: { id: true } })
  if (!row) return { error: NextResponse.json({ error: 'Plan d\'action introuvable' }, { status: 404 }) }
  return { userId }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { orgId, id } = await params
  const g = await guard(orgId, id)
  if ('error' in g) return g.error
  const body = await req.json().catch(() => ({}))

  const data: Prisma.PlanActionUpdateInput = {}
  if (typeof body?.titre === 'string' && body.titre.trim()) data.titre = body.titre.trim().slice(0, 200)
  if (typeof body?.description === 'string') data.description = body.description.trim().slice(0, 4000) || null
  if (typeof body?.porteur === 'string') data.porteur = body.porteur.trim().slice(0, 120) || null
  if (typeof body?.entite === 'string') data.entite = body.entite.trim().slice(0, 120) || null
  if (typeof body?.echeance === 'string') { const d = new Date(body.echeance); data.echeance = body.echeance && !isNaN(d.getTime()) ? d : null }
  if (body?.priorite != null) data.priorite = cleanPriorite(body.priorite)
  if (typeof body?.statut === 'string' && (RISK_ACTION_STATUTS as readonly string[]).includes(body.statut)) data.statut = body.statut

  // Ajout / retrait d'un lien source (multi-sources).
  if (body?.addLien) {
    const l = sanitizeLien(body.addLien)
    if (l) data.liens = { create: [{ type: l.type, targetId: l.targetId, ref: l.ref ?? null, label: l.label ?? null }] }
  }
  if (typeof body?.removeLienId === 'string' && body.removeLienId) {
    data.liens = { ...(data.liens ?? {}), deleteMany: [{ id: body.removeLienId }] }
  }

  const updated = await prisma.planAction.update({ where: { id }, data, include: { liens: true } })
  return NextResponse.json({ plan: updated })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { orgId, id } = await params
  const g = await guard(orgId, id)
  if ('error' in g) return g.error
  await prisma.planAction.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
