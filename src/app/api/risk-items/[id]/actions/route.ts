import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { validateRiskActionInput, cleanRiskActionInput, effectiveStatut, summarizeActions } from '@/lib/risk-action'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// Charge le risque parent dans le périmètre de l'utilisateur. `write` = exclut LECTEUR.
async function loadRisk(session: { user: { id: string; role?: string } }, id: string, write: boolean) {
  const userId = session.user.id
  const userRole = (session.user.role ?? 'ANALYSTE') as UserRole
  if (write && userRole === 'LECTEUR') return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  const scope = await getAnalyseScope(userId, userRole)
  const orgIds = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const risk = await prisma.riskItem.findFirst({
    where: { id, ...(orgIds ? { organizationId: { in: orgIds } } : {}) },
    select: { id: true, organizationId: true },
  })
  if (!risk) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  const orgConfig = await getOrgConfig(risk.organizationId)
  if (!orgConfig.registreRisquesActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  return { userId, userRole, orgId: risk.organizationId }
}

// GET /api/risk-items/[id]/actions — plan d'action du risque (+ statut effectif, synthèse).
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const ctx = await loadRisk(session as unknown as { user: { id: string; role?: string } }, id, false)
  if ('error' in ctx) return ctx.error

  const rows = await prisma.riskAction.findMany({ where: { riskItemId: id }, orderBy: [{ ordre: 'asc' }, { createdAt: 'asc' }] })
  const now = new Date()
  const actions = rows.map(a => ({ ...a, statutEffectif: effectiveStatut(a, now) }))
  return NextResponse.json({ actions, summary: summarizeActions(rows, now) })
}

// POST /api/risk-items/[id]/actions — ajouter une action (non-LECTEUR, module actif).
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  const ctx = await loadRisk(session as unknown as { user: { id: string; role?: string } }, id, true)
  if ('error' in ctx) return ctx.error

  const body = await req.json().catch(() => ({}))
  const erreur = validateRiskActionInput(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const data = cleanRiskActionInput(body)
  const action = await prisma.riskAction.create({ data: { ...data, riskItemId: id, organizationId: ctx.orgId } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.userRole, ip: getClientIp(req), details: { scope: 'risk-action', action: 'create', riskItemId: id, id: action.id } })
  return NextResponse.json(action, { status: 201 })
}
