// ─── Programme d'audit et de contrôle : plans de l'organisation active ────────
// GET : plans (d'audit et / ou de contrôle selon les modules actifs), avec le statut de chaque année.
// POST : crée un plan (rôle préparateur du type) et ses années, en brouillon. Spec : docs/specs/programme-audit-controle.md.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contextePlan, assurerAnnees } from '@/lib/planification.server'
import { cleanPlanInput, peutPreparer, TYPES_PLAN, type TypePlan } from '@/lib/planification'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, LIMIT_API_WRITE } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const c = await contextePlan()
  if ('error' in c) return c.error
  const demande = req.nextUrl.searchParams.get('type')
  const types = TYPES_PLAN.filter(t => c.modules[t] && (!demande || demande === t))
  const plans = await prisma.planProgramme.findMany({
    where: { organizationId: c.orgId, type: { in: [...types] } },
    orderBy: [{ type: 'asc' }, { nom: 'asc' }],
    include: { annees: { select: { annee: true, statut: true, valideLe: true, revision: true }, orderBy: { annee: 'asc' } }, _count: { select: { lignes: true } } },
  })
  return NextResponse.json({
    plans,
    modules: c.modules,
    peutCreer: Object.fromEntries(TYPES_PLAN.map(t => [t, c.modules[t] && peutPreparer(c.role, t, c.cfg)])),
    modeDefaut: c.cfg.modeDefaut,
  })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const c = await contextePlan()
  if ('error' in c) return c.error
  const rl = await rateLimit(`plans:${c.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
  const r = cleanPlanInput(await req.json().catch(() => ({})), c.cfg.modeDefaut)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  if (!c.modules[r.plan.type as TypePlan]) return NextResponse.json({ error: 'module_inactif' }, { status: 404 })
  if (!peutPreparer(c.role, r.plan.type, c.cfg)) return NextResponse.json({ error: 'role_preparateur_requis' }, { status: 403 })
  const plan = await prisma.planProgramme.create({ data: { ...r.plan, organizationId: c.orgId, createdById: c.userId } })
  await assurerAnnees(plan.id, plan.anneeDebut, plan.anneeFin)
  await auditLog('PLAN_PROGRAMME_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), targetType: 'plan', targetId: plan.id, details: { action: 'create', type: plan.type } })
  return NextResponse.json(plan, { status: 201 })
}
