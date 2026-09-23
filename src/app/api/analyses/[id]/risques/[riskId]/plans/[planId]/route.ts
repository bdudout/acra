// ─── Plan d'action d'un risque d'analyse — mise à jour / suppression ─────────
// PATCH  — met à jour un plan d'action (statut, priorité, échéance, titre, porteur).
// DELETE — détache/supprime le plan d'action.
// Mêmes gardes que la collection + le plan doit appartenir à l'org de l'analyse ET
// porter un lien RISQUE_ANALYSE vers le risque ciblé (isolation, sinon 404).

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { guardDirectRisk } from '@/lib/analyse-direct-risk.server'
import { cleanPriorite, RISK_ACTION_STATUTS } from '@/lib/risk-action'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string; riskId: string; planId: string }> }

function auth(session: unknown): { userId: string; role: UserRole } | null {
  const u = (session as { user?: { id?: string; role?: string } } | null)?.user
  if (!u?.id) return null
  return { userId: u.id, role: (u.role ?? 'ANALYSTE') as UserRole }
}

/** Vrai si le plan appartient à l'org ET porte un lien RISQUE_ANALYSE vers le risque. */
async function planOfRisk(planId: string, riskId: string, organizationId: string): Promise<boolean> {
  return (await prisma.planAction.count({
    where: { id: planId, organizationId, liens: { some: { type: 'RISQUE_ANALYSE', targetId: riskId } } },
  })) > 0
}

/** Champs assainis d'une mise à jour partielle d'un plan d'action de risque. */
function sanitizePlanPatch(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (typeof body.titre === 'string' && body.titre.trim()) out.titre = body.titre.trim().slice(0, 200)
  if ('porteur' in body) out.porteur = typeof body.porteur === 'string' && body.porteur.trim() ? body.porteur.trim().slice(0, 120) : null
  if ('echeance' in body) out.echeance = typeof body.echeance === 'string' && body.echeance ? new Date(body.echeance) : null
  if ('priorite' in body) out.priorite = cleanPriorite(body.priorite)
  if ('statut' in body && (RISK_ACTION_STATUTS as readonly string[]).includes(String(body.statut))) out.statut = String(body.statut)
  return out
}

// PATCH /api/analyses/:id/risques/:riskId/plans/:planId
export async function PATCH(req: NextRequest, { params }: Params) {
  const a = auth(await getServerSession(authOptions))
  if (!a) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id, riskId, planId } = await params
  const g = await guardDirectRisk(id, a.userId, a.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const organizationId = g.analyse.organizationId
  if (!organizationId) return NextResponse.json({ error: 'org_requise' }, { status: 400 })
  if (!(await planOfRisk(planId, riskId, organizationId))) return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 })

  const data = sanitizePlanPatch(await req.json().catch(() => ({})))
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'aucun_champ' }, { status: 400 })
  const p = await prisma.planAction.update({
    where: { id: planId }, data,
    select: { id: true, titre: true, statut: true, priorite: true, echeance: true, porteur: true },
  })
  await auditLog('WORKSHOP_SAVED', {
    userId: a.userId, userRole: a.role, organizationId: g.analyse.organizationId,
    targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'risque-plan-action', action: 'update', riskId, planId },
  })
  return NextResponse.json({ plan: { ...p, echeance: p.echeance ? p.echeance.toISOString() : null } })
}

// DELETE /api/analyses/:id/risques/:riskId/plans/:planId
export async function DELETE(req: NextRequest, { params }: Params) {
  const a = auth(await getServerSession(authOptions))
  if (!a) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id, riskId, planId } = await params
  const g = await guardDirectRisk(id, a.userId, a.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const organizationId = g.analyse.organizationId
  if (!organizationId) return NextResponse.json({ error: 'org_requise' }, { status: 400 })
  if (!(await planOfRisk(planId, riskId, organizationId))) return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 })

  await prisma.planAction.delete({ where: { id: planId } })
  await auditLog('WORKSHOP_SAVED', {
    userId: a.userId, userRole: a.role, organizationId: g.analyse.organizationId,
    targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'risque-plan-action', action: 'delete', riskId, planId },
  })
  return NextResponse.json({ ok: true })
}
