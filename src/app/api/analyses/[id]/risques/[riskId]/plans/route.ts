// ─── Plans d'action rattachés à un risque d'analyse (saisie directe) ─────────
// GET  — liste les plans d'action (objet PlanAction unifié) rattachés au risque.
// POST — crée un plan d'action rattaché au risque (lien RISQUE_ANALYSE → réduction
//        actuel → résiduel). Réutilise l'objet PlanAction (visible dans /plans-actions).
// Mêmes gardes que la collection risques (accès, méthode à saisie directe, édition,
// gel) + le risque doit appartenir à l'analyse ciblée (sinon 404, sans divulgation).

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { guardDirectRisk } from '@/lib/analyse-direct-risk.server'
import { validatePlanActionInput, cleanPlanActionInput } from '@/lib/plan-action'
import { createAnalyseRiskPlanAction, findAnalyseRiskPlanActions } from '@/lib/plan-action.server'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string; riskId: string }> }

function auth(session: unknown): { userId: string; role: UserRole } | null {
  const u = (session as { user?: { id?: string; role?: string } } | null)?.user
  if (!u?.id) return null
  return { userId: u.id, role: (u.role ?? 'ANALYSTE') as UserRole }
}

/** Charge le risque (intitulé) en s'assurant qu'il appartient à l'analyse ciblée. */
async function riskOfAnalyse(riskId: string, analyseId: string) {
  return prisma.risque.findFirst({ where: { id: riskId, analyseId }, select: { id: true, nom: true } })
}

/** Projette un PlanAction vers la forme compacte consommée par le panneau du risque. */
function toPlanRow(p: { id: string; titre: string; statut: string; priorite: string; echeance: Date | null; porteur: string | null }) {
  return { id: p.id, titre: p.titre, statut: p.statut, priorite: p.priorite, echeance: p.echeance ? p.echeance.toISOString() : null, porteur: p.porteur }
}

// GET /api/analyses/:id/risques/:riskId/plans
export async function GET(_req: NextRequest, { params }: Params) {
  const a = auth(await getServerSession(authOptions))
  if (!a) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id, riskId } = await params
  const g = await guardDirectRisk(id, a.userId, a.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const organizationId = g.analyse.organizationId
  if (!organizationId) return NextResponse.json({ error: 'org_requise' }, { status: 400 })
  if (!(await riskOfAnalyse(riskId, g.analyse.id))) return NextResponse.json({ error: 'Risque introuvable' }, { status: 404 })

  const plans = await findAnalyseRiskPlanActions(prisma, organizationId, riskId)
  return NextResponse.json({ plans: plans.map(toPlanRow) })
}

// POST /api/analyses/:id/risques/:riskId/plans — rattache un plan d'action au risque.
export async function POST(req: NextRequest, { params }: Params) {
  const a = auth(await getServerSession(authOptions))
  if (!a) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id, riskId } = await params
  const g = await guardDirectRisk(id, a.userId, a.role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const organizationId = g.analyse.organizationId
  if (!organizationId) return NextResponse.json({ error: 'org_requise' }, { status: 400 })
  const risque = await riskOfAnalyse(riskId, g.analyse.id)
  if (!risque) return NextResponse.json({ error: 'Risque introuvable' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const err = validatePlanActionInput(body)
  if (err) return NextResponse.json({ error: err }, { status: 400 })
  const clean = cleanPlanActionInput(body)

  const plan = await createAnalyseRiskPlanAction(prisma, {
    organizationId,
    risqueId: riskId,
    analyseId: g.analyse.id,
    titre: clean.titre,
    description: clean.description,
    porteur: clean.porteur,
    entite: clean.entite,
    echeance: clean.echeance ? new Date(clean.echeance) : null,
    statut: clean.statut,
    priorite: clean.priorite,
    createdById: a.userId,
    riskLabel: risque.nom,
  })
  await auditLog('WORKSHOP_SAVED', {
    userId: a.userId, userRole: a.role, organizationId: g.analyse.organizationId,
    targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'risque-plan-action', action: 'create', riskId, planId: plan.id },
  })
  return NextResponse.json({ plan: toPlanRow(plan) }, { status: 201 })
}
