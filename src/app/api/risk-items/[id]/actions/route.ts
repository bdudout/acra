import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { withAccess } from '@/lib/with-access.server'
import { type SessionUser } from '@/lib/route-guard.server'
import { validateRiskActionInput, cleanRiskActionInput, effectiveStatut, summarizeActions, defaultEcheanceForPriorite } from '@/lib/risk-action'
import { toRiskActionShape } from '@/lib/plan-action'
import { createRiskLinkedPlanAction, findRiskLinkedPlanActions } from '@/lib/plan-action.server'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Charge le risque parent dans le périmètre de l'utilisateur. `write` = exclut LECTEUR.
// Périmètre visible complet (SUPER_ADMIN non focalisé inclus) → les handlers utilisent `org: 'none'`.
async function loadRisk(user: SessionUser, id: string, write: boolean) {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  if (write && userRole === 'LECTEUR') return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const risk = await prisma.riskItem.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true },
  })
  if (!risk) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  const orgConfig = await getOrgConfig(risk.organizationId)
  if (!orgConfig.registreRisquesActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  return { error: null, userId, userRole, orgId: risk.organizationId, orgConfig }
}

// GET /api/risk-items/[id]/actions — plan d'action du risque (+ statut effectif, synthèse).
export const GET = withAccess({ org: 'none' }, async (_req, { user, params: { id } }) => {
  const ctx = await loadRisk(user, id, false)
  if (ctx.error) return ctx.error

  const rows = (await findRiskLinkedPlanActions(prisma, ctx.orgId, id)).map(toRiskActionShape)
  const now = new Date()
  const actions = rows.map(a => ({ ...a, statutEffectif: effectiveStatut(a, now) }))
  return NextResponse.json({ actions, summary: summarizeActions(rows, now) })
})

// POST /api/risk-items/[id]/actions — ajouter une action (non-LECTEUR, module actif).
export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'risk-actions' } }, async (req, { user, params: { id } }) => {
  const ctx = await loadRisk(user, id, true)
  if (ctx.error) return ctx.error

  const body = await req.json().catch(() => ({}))
  const erreur = validateRiskActionInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanRiskActionInput(body)
  // Échéance par défaut (si non fournie) selon la priorité + délais configurés de l'org.
  const echeance = data.echeance ?? new Date(defaultEcheanceForPriorite(data.priorite, ctx.orgConfig.actionDelaisMois))
  const created = await createRiskLinkedPlanAction(prisma, {
    organizationId: ctx.orgId, riskItemId: id,
    titre: data.intitule, description: data.description, porteur: data.responsable,
    echeance, statut: data.statut, priorite: data.priorite, createdById: ctx.userId,
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.userRole, ip: getClientIp(req), details: { scope: 'risk-action', action: 'create', riskItemId: id, id: created.id } })
  return NextResponse.json(toRiskActionShape(created), { status: 201 })
})
