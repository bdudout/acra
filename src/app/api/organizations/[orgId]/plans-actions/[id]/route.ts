/**
 * Un plan d'action : mise à jour (champs + ajout/retrait de liens) et suppression.
 * Réservé aux rôles de gouvernance.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { peutGererPlansAction } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { cleanPriorite, RISK_ACTION_STATUTS } from '@/lib/risk-action'
import { sanitizeLien } from '@/lib/plan-action'
import { entiteIdPourTexte } from '@/lib/entites.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
const access = { org: { param: 'orgId' }, allow: peutGererPlansAction, rateLimit: { bucket: 'plans-actions' } } as const

/** Plan d'action de l'organisation (404 sinon, aucune divulgation). */
const planExiste = (orgId: string, id: string) => prisma.planAction.findFirst({ where: { id, organizationId: orgId }, select: { id: true } })
const introuvable = () => NextResponse.json({ error: 'Plan d\'action introuvable' }, { status: 404 })

// PATCH /api/organizations/[orgId]/plans-actions/[id] — met à jour un plan d'action unifié (champs et/ou liens de rattachement).
export const PATCH = withAccess(access, async (req, { user, role, orgId, params: { id } }) => {
  if (!(await planExiste(orgId, id))) return introuvable()
  const body = await req.json().catch(() => ({}))

  const data: Prisma.PlanActionUpdateInput = {}
  if (typeof body?.titre === 'string' && body.titre.trim()) data.titre = body.titre.trim().slice(0, 200)
  if (typeof body?.description === 'string') data.description = body.description.trim().slice(0, 4000) || null
  if (typeof body?.porteur === 'string') data.porteur = body.porteur.trim().slice(0, 120) || null
  if (typeof body?.entite === 'string') {
    const entite = body.entite.trim().slice(0, 120) || null
    data.entite = entite
    // Lien au référentiel recalculé (texte identique) ou retiré (lot E5).
    const entiteId = await entiteIdPourTexte(orgId, entite)
    data.entiteRef = entiteId ? { connect: { id: entiteId } } : { disconnect: true }
  }
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
  await auditLog('PLAN_ACTION_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'plan_action', targetId: id, details: { action: 'update', champs: Object.keys(data) } })
  return NextResponse.json({ plan: updated })
})

// DELETE /api/organizations/[orgId]/plans-actions/[id] — supprime un plan d'action unifié.
export const DELETE = withAccess(access, async (req, { user, role, orgId, params: { id } }) => {
  if (!(await planExiste(orgId, id))) return introuvable()
  await prisma.planAction.delete({ where: { id } })
  await auditLog('PLAN_ACTION_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), targetType: 'plan_action', targetId: id, details: { action: 'delete' } })
  return NextResponse.json({ ok: true })
})
