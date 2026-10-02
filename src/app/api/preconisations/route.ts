// ─── Préconisations des contrôleurs (cf. docs/specs/questionnaires-controle.md) ─
// GET : la 2ᵉ ligne voit toutes les préconisations ; un métier voit celles dont il est responsable.
// POST (2ᵉ ligne) : création, éventuellement depuis une réponse revue (reponseId + questionId) : la cible
// de la question (exigence, risque, processus, point de contrôle) est alors reprise.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { questionnaireContext, refuse, repondantsPossibles } from '@/lib/questionnaire.server'
import { cleanConstatInput, validateConstatInput } from '@/lib/audit'
import { sanitizeQuestions } from '@/lib/questionnaire'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const r = await questionnaireContext()
  if (!r.ok) return r.response
  const { ctx } = r
  const preconisations = await prisma.preconisation.findMany({
    where: { organizationId: ctx.orgId, ...(ctx.canDefine ? {} : { responsableId: ctx.userId }) },
    orderBy: [{ statut: 'asc' }, { echeance: 'asc' }, { createdAt: 'desc' }],
  })
  // Plans d'action liés (lien PRECONISATION), pour le suivi.
  const liens = await prisma.planActionLien.findMany({
    where: { type: 'PRECONISATION', targetId: { in: preconisations.map(p => p.id) }, planAction: { organizationId: ctx.orgId } },
    select: { targetId: true, planAction: { select: { id: true, titre: true, statut: true, echeance: true } } },
  })
  const plans = new Map<string, { id: string; titre: string; statut: string; echeance: Date | null }[]>()
  for (const l of liens) plans.set(l.targetId, [...(plans.get(l.targetId) ?? []), l.planAction])
  return NextResponse.json({
    preconisations: preconisations.map(p => ({ ...p, plansAction: plans.get(p.id) ?? [] })),
    canDefine: ctx.canDefine,
    ...(ctx.canDefine ? { responsables: await repondantsPossibles(ctx.orgId) } : {}),
  })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const r = await questionnaireContext()
  if (!r.ok) return r.response
  const { ctx } = r
  if (!ctx.canDefine) return refuse(403, 'forbidden')
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const err = validateConstatInput(body)
  if (err) return refuse(400, err)
  const c = cleanConstatInput(body)
  const data: Record<string, unknown> = {
    intitule: c.intitule, description: c.description, recommandation: c.recommandation, criticite: c.criticite,
    responsableAction: c.responsableAction, echeance: c.echeance, echeanceInitiale: c.echeance,
    referentielCode: c.referentielCode, exigenceRef: c.exigenceRef,
  }
  // Responsable métier : un compte de l'organisation (il pourra créer le plan d'action ou accepter le risque).
  if (typeof body.responsableId === 'string' && body.responsableId) {
    const permis = await repondantsPossibles(ctx.orgId)
    const u = permis.find(x => x.id === body.responsableId)
    if (!u) return refuse(400, 'responsable_invalide')
    data.responsableId = u.id
    data.responsableAction = c.responsableAction ?? u.name ?? u.email
  }
  if (typeof body.campagneId === 'string' && body.campagneId) {
    if (!(await prisma.campagneControle.findFirst({ where: { id: body.campagneId, organizationId: ctx.orgId }, select: { id: true } }))) return refuse(400, 'mission_invalide')
    data.campagneId = body.campagneId
  }
  if (typeof body.reponseId === 'string' && body.reponseId) {
    const rep = await prisma.questionnaireReponse.findFirst({ where: { id: body.reponseId, organizationId: ctx.orgId }, include: { envoi: { select: { questions: true, campagneId: true } } } })
    if (!rep) return refuse(400, 'reponse_invalide')
    data.reponseId = rep.id
    data.campagneId ??= rep.envoi.campagneId
    const q = typeof body.questionId === 'string' ? sanitizeQuestions(rep.envoi.questions).find(x => x.id === body.questionId) : undefined
    if (q) {
      data.questionId = q.id
      if (q.cible?.type === 'EXIGENCE') { data.referentielCode ??= q.cible.referentielCode; data.exigenceRef ??= q.cible.ref }
      if (q.cible?.type === 'RISQUE') data.riskItemId = q.cible.id
      if (q.cible?.type === 'PROCESSUS') data.processusId = q.cible.id
      if (q.cible?.type === 'CONTROLE') data.controleId = q.cible.id
    }
    // Par défaut, le responsable est le répondant (le métier concerné).
    data.responsableId ??= rep.repondantId
  }
  if (c.riskItemId) {
    if (!(await prisma.riskItem.findFirst({ where: { id: c.riskItemId, organizationId: ctx.orgId }, select: { id: true } }))) return refuse(400, 'risque_invalide')
    data.riskItemId = c.riskItemId
  }
  if (data.responsableId && !data.responsableAction) {
    const u = await prisma.user.findUnique({ where: { id: data.responsableId as string }, select: { name: true, email: true } })
    data.responsableAction = u?.name ?? u?.email ?? null
  }
  const preconisation = await prisma.preconisation.create({ data: { ...data, organizationId: ctx.orgId, createdById: ctx.userId } as never })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'preconisation', action: 'create', id: preconisation.id, reponseId: data.reponseId ?? null } })
  return NextResponse.json({ preconisation }, { status: 201 })
}
