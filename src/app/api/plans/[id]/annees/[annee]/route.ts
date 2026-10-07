// ─── Programme d'audit et de contrôle : cycle de validation d'une année ────────
// PATCH { action: SOUMETTRE | VALIDER | RENVOYER | REVISER, commentaire?, motif? } — règles : lib/planification
// (rôles préparateurs / validateurs configurés, double regard optionnel, plan figé ou dynamique). À la validation, les
// lignes de l'année sont figées dans `contenu` ; chaque transition est ajoutée à l'historique et journalisée.
// Transition conditionnée au statut lu (updateMany) : un changement concurrent est refusé (409), jamais écrasé.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contextePlan, chargerPlan } from '@/lib/planification.server'
import { figerLignes, transitionPlanAnnee, type ActionPlan, type ModePlan, type StatutAnnee, type TypePlan } from '@/lib/planification'
import { auditLog, getClientIp } from '@/lib/logger'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string; annee: string }> }
const ACTIONS = ['SOUMETTRE', 'VALIDER', 'RENVOYER', 'REVISER'] as const

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const c = await contextePlan()
  if ('error' in c) return c.error
  const { id, annee: a } = await params
  const plan = await chargerPlan(id, c)
  if (!plan) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const annee = await prisma.planAnnee.findUnique({ where: { planId_annee: { planId: plan.id, annee: Number(a) } } })
  if (!annee) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const body = await req.json().catch(() => ({})) as { action?: string; commentaire?: string; motif?: string }
  if (!(ACTIONS as readonly string[]).includes(body.action ?? '')) return NextResponse.json({ error: 'action_invalide' }, { status: 400 })
  const commentaire = typeof body.commentaire === 'string' ? body.commentaire.trim().slice(0, 2000) : ''
  const t = transitionPlanAnnee(annee.statut as StatutAnnee, { action: body.action, commentaire, motif: body.motif } as ActionPlan, {
    type: plan.type as TypePlan, mode: plan.mode as ModePlan, role: c.role, userId: c.userId, preparePar: annee.preparePar, config: c.cfg,
  })
  if (!t.ok) return NextResponse.json({ error: t.error }, { status: t.error === 'transition_interdite' ? 409 : t.error === 'motif_requis' ? 400 : 403 })

  const maintenant = new Date()
  const data: Record<string, unknown> = { statut: t.statut, ...t.patch }
  if (t.patch.preparePar) data.prepareLe = maintenant
  if (t.figer) {
    const lignes = await prisma.planLigne.findMany({ where: { planId: plan.id, annee: annee.annee }, orderBy: [{ debut: 'asc' }, { intitule: 'asc' }] })
    Object.assign(data, { valideLe: maintenant, contenu: figerLignes(lignes) as unknown as Prisma.InputJsonValue, commentaire: commentaire || null })
  }
  if (t.revision) data.revision = annee.revision + 1
  const historique = [...(Array.isArray(annee.historique) ? annee.historique : []), { action: body.action, statut: t.statut, par: c.userId, le: maintenant.toISOString(), ...(commentaire ? { commentaire } : {}), ...(t.patch.motifRevision ? { motif: t.patch.motifRevision } : {}) }]
  const res = await prisma.planAnnee.updateMany({ where: { id: annee.id, statut: annee.statut }, data: { ...data, historique: historique as unknown as Prisma.InputJsonValue } })
  if (res.count === 0) return NextResponse.json({ error: 'statut_modifie' }, { status: 409 })
  await auditLog('PLAN_PROGRAMME_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), targetType: 'plan', targetId: plan.id, details: { action: body.action, annee: annee.annee, statut: t.statut } })
  return NextResponse.json({ ok: true, statut: t.statut })
}
