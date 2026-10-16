import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { withAccess } from '@/lib/with-access.server'
import { type SessionUser } from '@/lib/route-guard.server'
import { validateRiskActionInput, cleanRiskActionInput } from '@/lib/risk-action'
import { toRiskActionShape } from '@/lib/plan-action'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// `org: 'none'` : l'action est cherchée dans tout le périmètre visible (SUPER_ADMIN non focalisé inclus).
const access = { org: 'none', rateLimit: { bucket: 'risk-actions' } } as const

// Charge l'action dans le périmètre de l'utilisateur (non-LECTEUR), rattachée au bon risque.
async function loadAction(user: SessionUser, riskItemId: string, actionId: string) {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  if (userRole === 'LECTEUR') return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  // L'action = un PlanAction porteur d'un lien RISQUE vers ce risque, dans le périmètre.
  const action = await prisma.planAction.findFirst({
    where: {
      id: actionId,
      ...(orgIds ? { organizationId: { in: orgIds } } : {}),
      liens: { some: { type: 'RISQUE', targetId: riskItemId } },
    },
    select: { id: true },
  })
  if (!action) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  return { error: null, userId, userRole }
}

// PATCH /api/risk-items/[id]/actions/[actionId] — mettre à jour une action.
export const PATCH = withAccess(access, async (req, { user, params: { id, actionId } }) => {
  const ctx = await loadAction(user, id, actionId)
  if (ctx.error) return ctx.error

  const body = await req.json().catch(() => ({}))
  const erreur = validateRiskActionInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanRiskActionInput(body)
  const updated = await prisma.planAction.update({
    where: { id: actionId },
    data: { titre: data.intitule, description: data.description, porteur: data.responsable, echeance: data.echeance, statut: data.statut, priorite: data.priorite },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.userRole, ip: getClientIp(req), details: { scope: 'risk-action', action: 'update', riskItemId: id, id: actionId } })
  return NextResponse.json(toRiskActionShape(updated))
})

// DELETE /api/risk-items/[id]/actions/[actionId] — supprimer une action.
export const DELETE = withAccess(access, async (req, { user, params: { id, actionId } }) => {
  const ctx = await loadAction(user, id, actionId)
  if (ctx.error) return ctx.error
  await prisma.planAction.delete({ where: { id: actionId } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.userRole, ip: getClientIp(req), details: { scope: 'risk-action', action: 'delete', riskItemId: id, id: actionId } })
  return NextResponse.json({ ok: true })
})
