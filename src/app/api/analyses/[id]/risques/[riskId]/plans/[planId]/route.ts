// ─── Plan d'action d'un risque d'analyse — mise à jour / suppression ─────────
// PATCH  — met à jour un plan d'action (statut, priorité, échéance, titre, porteur).
// DELETE — détache/supprime le plan d'action.
// Mêmes gardes que la collection + le plan doit appartenir à l'org de l'analyse ET
// porter un lien RISQUE_ANALYSE vers le risque ciblé (isolation, sinon 404).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { guardDirectRisk } from '@/lib/analyse-direct-risk.server'
import { cleanPriorite, RISK_ACTION_STATUTS } from '@/lib/risk-action'

export const dynamic = 'force-dynamic'

/** Vrai si le risque appartient à l'analyse éditée ET le plan (de l'org) porte un lien RISQUE_ANALYSE vers lui. */
async function planOfRisk(planId: string, riskId: string, analyseId: string, organizationId: string): Promise<boolean> {
  if ((await prisma.risque.count({ where: { id: riskId, analyseId } })) === 0) return false
  return (await prisma.planAction.count({
    where: { id: planId, organizationId, liens: { some: { type: 'RISQUE_ANALYSE', targetId: riskId } } },
  })) > 0
}

/** Champs assainis d'une mise à jour partielle d'un plan d'action de risque. */
function sanitizePlanPatch(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (typeof body.titre === 'string' && body.titre.trim()) out.titre = body.titre.trim().slice(0, 200)
  if ('porteur' in body) out.porteur = typeof body.porteur === 'string' && body.porteur.trim() ? body.porteur.trim().slice(0, 120) : null
  if ('echeance' in body) {
    const d = typeof body.echeance === 'string' && body.echeance ? new Date(body.echeance) : null
    if (d === null || !Number.isNaN(d.getTime())) out.echeance = d // date illisible : ignorée
  }
  if ('priorite' in body) out.priorite = cleanPriorite(body.priorite)
  if ('statut' in body && (RISK_ACTION_STATUTS as readonly string[]).includes(String(body.statut))) out.statut = String(body.statut)
  return out
}

// PATCH /api/analyses/:id/risques/:riskId/plans/:planId
export const PATCH = withAccess({ org: 'none', rateLimit: { bucket: 'analyse-risques' } }, async (req, { user, params: { id, riskId, planId } }) => {
  const g = await guardDirectRisk(id, user.id, user.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const organizationId = g.analyse.organizationId
  if (!organizationId) return NextResponse.json({ error: 'org_requise' }, { status: 400 })
  if (!(await planOfRisk(planId, riskId, g.analyse.id, organizationId))) return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 })

  const data = sanitizePlanPatch(await req.json().catch(() => ({})))
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'aucun_champ' }, { status: 400 })
  const p = await prisma.planAction.update({
    where: { id: planId }, data,
    select: { id: true, titre: true, statut: true, priorite: true, echeance: true, porteur: true },
  })
  await auditLog('WORKSHOP_SAVED', {
    userId: user.id, userRole: user.role, organizationId: g.analyse.organizationId,
    targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'risque-plan-action', action: 'update', riskId, planId },
  })
  return NextResponse.json({ plan: { ...p, echeance: p.echeance ? p.echeance.toISOString() : null } })
})

// DELETE /api/analyses/:id/risques/:riskId/plans/:planId
export const DELETE = withAccess({ org: 'none', rateLimit: { bucket: 'analyse-risques' } }, async (req, { user, params: { id, riskId, planId } }) => {
  const g = await guardDirectRisk(id, user.id, user.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const organizationId = g.analyse.organizationId
  if (!organizationId) return NextResponse.json({ error: 'org_requise' }, { status: 400 })
  if (!(await planOfRisk(planId, riskId, g.analyse.id, organizationId))) return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 })

  await prisma.planAction.delete({ where: { id: planId } })
  await auditLog('WORKSHOP_SAVED', {
    userId: user.id, userRole: user.role, organizationId: g.analyse.organizationId,
    targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'risque-plan-action', action: 'delete', riskId, planId },
  })
  return NextResponse.json({ ok: true })
})
