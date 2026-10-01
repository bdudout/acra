// POST { titre?, description?, echeance?, lierConformite?, lierRisque? } : le métier responsable (ou la
// 2ᵉ ligne) répond à la préconisation par un plan d'action, suivi dans les plans d'action (lien
// PRECONISATION). Le lien à la conformité (exigence) et au risque est FACULTATIF.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { chargerPreconisation, refuse } from '@/lib/questionnaire.server'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const c = await chargerPreconisation(id)
  if (!c.ctx) return c.response!
  const { ctx, preconisation: p } = c
  if (p.responsableId !== ctx.userId && !ctx.canDefine) return refuse(403, 'forbidden')
  if (p.statut !== 'OUVERT' && p.statut !== 'EN_COURS') return refuse(409, 'transition_interdite')
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const titre = (typeof body.titre === 'string' && body.titre.trim() ? body.titre.trim() : p.intitule).slice(0, 200)
  const echeance = typeof body.echeance === 'string' && body.echeance ? new Date(body.echeance) : p.echeance
  if (echeance && Number.isNaN(echeance.getTime())) return refuse(400, 'echeance_invalide')
  const liens: { type: string; targetId: string; ref?: string; label?: string }[] = [{ type: 'PRECONISATION', targetId: p.id, label: p.intitule.slice(0, 200) }]
  if (body.lierConformite === true && p.referentielCode && p.exigenceRef) liens.push({ type: 'CONFORMITE', targetId: p.referentielCode, ref: p.exigenceRef, label: `${p.referentielCode} ${p.exigenceRef}` })
  if (body.lierRisque === true && p.riskItemId) liens.push({ type: 'RISQUE', targetId: p.riskItemId })
  const plan = await prisma.$transaction(async tx => {
    const created = await tx.planAction.create({ data: {
      organizationId: ctx.orgId, titre, description: typeof body.description === 'string' ? body.description.trim().slice(0, 4000) || null : p.recommandation,
      porteur: p.responsableId === ctx.userId ? ctx.userName : p.responsableAction, echeance, statut: 'A_FAIRE',
      priorite: (p.criticite ?? 0) >= 3 ? 'CRITIQUE' : 'MAJEUR', createdById: ctx.userId, liens: { create: liens },
    }, select: { id: true, titre: true, statut: true } })
    if (p.statut === 'OUVERT') await tx.preconisation.update({ where: { id }, data: { statut: 'EN_COURS' } })
    return created
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'preconisation', action: 'plan-action', id, planActionId: plan.id, liens: liens.map(l => l.type) } })
  return NextResponse.json({ planAction: plan }, { status: 201 })
}
