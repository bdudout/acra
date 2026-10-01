// ─── Envois de questionnaires (2ᵉ ligne) ─────────────────────────────────────
// GET : envois avec avancement des réponses, modèles actifs, missions de contrôle et répondants possibles.
// POST { modeleId, repondantIds, campagneId?, echeance?, titre? } : fige les questions du modèle et crée
// une réponse « à répondre » par répondant (comptes de l'organisation uniquement).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { questionnaireContext, refuse, repondantsPossibles } from '@/lib/questionnaire.server'
import { sanitizeQuestions } from '@/lib/questionnaire'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const r = await questionnaireContext()
  if (!r.ok) return r.response
  const { ctx } = r
  if (!ctx.canDefine) return refuse(403, 'forbidden')
  const [envois, modeles, campagnes, repondants] = await Promise.all([
    prisma.questionnaireEnvoi.findMany({
      where: { organizationId: ctx.orgId }, orderBy: { createdAt: 'desc' },
      select: { id: true, titre: true, campagneId: true, echeance: true, statut: true, createdAt: true, reponses: { select: { statut: true } } },
    }),
    prisma.questionnaireModele.findMany({ where: { organizationId: ctx.orgId, actif: true }, select: { id: true, titre: true, mode: true }, orderBy: { titre: 'asc' } }),
    prisma.campagneControle.findMany({ where: { organizationId: ctx.orgId, archiveLe: null }, select: { id: true, intitule: true, statut: true }, orderBy: { createdAt: 'desc' } }),
    repondantsPossibles(ctx.orgId),
  ])
  return NextResponse.json({
    envois: envois.map(({ reponses, ...e }) => ({ ...e, avancement: reponses.reduce<Record<string, number>>((acc, x) => ({ ...acc, [x.statut]: (acc[x.statut] ?? 0) + 1 }), {}), total: reponses.length })),
    modeles, campagnes, repondants,
  })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const r = await questionnaireContext()
  if (!r.ok) return r.response
  const { ctx } = r
  if (!ctx.canDefine) return refuse(403, 'forbidden')
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const modele = typeof body.modeleId === 'string'
    ? await prisma.questionnaireModele.findFirst({ where: { id: body.modeleId, organizationId: ctx.orgId, actif: true } }) : null
  if (!modele) return refuse(400, 'modele_invalide')
  const questions = sanitizeQuestions(modele.questions)
  if (!questions.length) return refuse(400, 'questions_requises')
  // Répondants : uniquement des comptes ayant accès à l'organisation (jamais d'identifiant arbitraire).
  const permis = new Set((await repondantsPossibles(ctx.orgId)).map(u => u.id))
  const ids = [...new Set(Array.isArray(body.repondantIds) ? body.repondantIds.filter((x): x is string => typeof x === 'string') : [])]
  if (!ids.length || ids.length > 200 || ids.some(id => !permis.has(id))) return refuse(400, 'repondants_invalides')
  let campagneId: string | null = null
  if (typeof body.campagneId === 'string' && body.campagneId) {
    const campagne = await prisma.campagneControle.findFirst({ where: { id: body.campagneId, organizationId: ctx.orgId }, select: { id: true } })
    if (!campagne) return refuse(400, 'mission_invalide')
    campagneId = campagne.id
  }
  const echeance = typeof body.echeance === 'string' && body.echeance ? new Date(body.echeance) : null
  if (echeance && Number.isNaN(echeance.getTime())) return refuse(400, 'echeance_invalide')
  const titre = typeof body.titre === 'string' && body.titre.trim() ? body.titre.trim().slice(0, 200) : modele.titre
  const envoi = await prisma.questionnaireEnvoi.create({ data: {
    organizationId: ctx.orgId, modeleId: modele.id, campagneId, titre, questions: questions as object[], echeance, createdById: ctx.userId,
    reponses: { create: ids.map(repondantId => ({ organizationId: ctx.orgId, repondantId })) },
  }, select: { id: true } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), details: { scope: 'questionnaire', action: 'envoi', id: envoi.id, modeleId: modele.id, repondants: ids.length, campagneId } })
  return NextResponse.json({ envoi }, { status: 201 })
}
