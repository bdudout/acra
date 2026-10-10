import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'
import { tierContext } from '@/lib/tier-registry.server'
import type { UserRole } from '@/lib/permissions'
import { getOrgConfig } from '@/lib/org-config.server'
import { resolveEchelles, type EchellesEcosysteme } from '@/lib/ecosystem-echelles'
import {
  coterEvaluation, peutEvaluerTiers, peutValiderEvaluationTiers, prochaineEvaluation, sanitizeEvaluationTiers, transitionEvaluationTiers,
  type ActionEvaluationTiers, type Cotation, type StatutEvaluationTiers,
} from '@/lib/tier-evaluation'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ usageId: string }> }

// ─── Évaluation d'un usage de service tiers (lot T1) ──────────────────────────
// GET : évaluation, cotation (menace et zone actuelle / cible), droits, échelles et listes de rattachement de l'organisation.
// PUT : enregistre (brouillon) — propriétaire du risque / analyste ; modifier une évaluation soumise ou validée la repasse en
// brouillon. POST { action } : SOUMETTRE (évaluateur), VALIDER / RENVOYER (RSSI). Usage de l'organisation active seulement.
type Charge = { error: NextResponse } | { ctx: { userId: string; orgId: string; role: UserRole }; echelles: EchellesEcosysteme; petiteStructure: boolean }
async function charger(usageId: string): Promise<Charge> {
  const got = await tierContext(); if ('error' in got) return { error: got.error }
  const { ctx } = got
  const usage = await prisma.tierServiceUsage.findUnique({ where: { id: usageId }, select: { id: true, organizationId: true } })
  if (!usage || usage.organizationId !== ctx.orgId) return { error: NextResponse.json({ error: 'not_found' }, { status: 404 }) }
  const cfg = await getOrgConfig(ctx.orgId)
  const echelles = resolveEchelles(cfg.echellesEcosysteme as Partial<EchellesEcosysteme> | null)
  return { ctx, echelles, petiteStructure: !!cfg.petiteStructure }
}
const limiter = async (userId: string) => {
  const rl = await rateLimit(`tier-registry:${userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  return rl.allowed ? null : NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
}

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { usageId } = await params
  const c = await charger(usageId); if ('error' in c) return c.error
  const [ev, traitements, risques] = await Promise.all([
    prisma.evaluationUsageTiers.findUnique({ where: { usageId } }),
    prisma.traitement.findMany({ where: { organizationId: c.ctx.orgId }, select: { id: true, nom: true }, orderBy: { nom: 'asc' }, take: 500 }),
    prisma.riskItem.findMany({ where: { organizationId: c.ctx.orgId }, select: { id: true, intitule: true, taxonomieCode: true }, orderBy: { intitule: 'asc' }, take: 500 }),
  ])
  const saisie = sanitizeEvaluationTiers(ev ?? {}, c.echelles)
  return NextResponse.json({
    evaluation: ev ? { ...saisie, statut: ev.statut, evaluePar: ev.evaluePar, soumisLe: ev.soumisLe, validePar: ev.validePar, valideLe: ev.valideLe } : null,
    cotation: coterEvaluation(saisie, c.echelles),
    prochaineEvaluation: prochaineEvaluation(ev?.valideLe ?? null),
    droits: { peutEvaluer: peutEvaluerTiers(c.ctx.role), peutValider: peutValiderEvaluationTiers(c.ctx.role, { petiteStructure: c.petiteStructure }) },
    echelles: c.echelles,
    options: { traitements, risques },
  })
}

export async function PUT(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { usageId } = await params
  const c = await charger(usageId); if ('error' in c) return c.error
  if (!peutEvaluerTiers(c.ctx.role)) return NextResponse.json({ error: 'role_evaluateur_requis' }, { status: 403 })
  const limite = await limiter(c.ctx.userId); if (limite) return limite
  const saisie = sanitizeEvaluationTiers(await req.json().catch(() => ({})), c.echelles)
  // Rattachements limités à l'organisation active (jamais un traitement ou un risque d'une autre organisation).
  const [traitements, risques] = await Promise.all([
    saisie.traitementIds.length ? prisma.traitement.findMany({ where: { id: { in: saisie.traitementIds }, organizationId: c.ctx.orgId }, select: { id: true } }) : [],
    saisie.risqueIds.length ? prisma.riskItem.findMany({ where: { id: { in: saisie.risqueIds }, organizationId: c.ctx.orgId }, select: { id: true } }) : [],
  ])
  const ok = (liste: string[], trouves: { id: string }[]) => liste.filter(id => trouves.some(t => t.id === id))
  const data = {
    actuelle: saisie.actuelle, cible: saisie.cible ?? undefined, clauses: saisie.clauses,
    traitementIds: ok(saisie.traitementIds, traitements), risqueIds: ok(saisie.risqueIds, risques), justification: saisie.justification,
    statut: 'BROUILLON', evaluePar: c.ctx.userId, validePar: null, valideLe: null,
  }
  const ev = await prisma.evaluationUsageTiers.upsert({ where: { usageId }, create: { usageId, organizationId: c.ctx.orgId, ...data }, update: data })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.ctx.userId, userRole: c.ctx.role, organizationId: c.ctx.orgId, ip: getClientIp(req), details: { scope: 'tier-registry', action: 'usage-evaluation', usageId } })
  return NextResponse.json({ ok: true, statut: ev.statut, cotation: coterEvaluation(saisie, c.echelles) })
}

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { usageId } = await params
  const c = await charger(usageId); if ('error' in c) return c.error
  const limite = await limiter(c.ctx.userId); if (limite) return limite
  const action = ((await req.json().catch(() => ({}))) as { action?: string }).action
  if (action !== 'SOUMETTRE' && action !== 'VALIDER' && action !== 'RENVOYER') return NextResponse.json({ error: 'action_invalide' }, { status: 400 })
  const ev = await prisma.evaluationUsageTiers.findUnique({ where: { usageId } })
  if (!ev) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const t = transitionEvaluationTiers(ev.statut as StatutEvaluationTiers, action as ActionEvaluationTiers, {
    role: c.ctx.role, petiteStructure: c.petiteStructure, evaluation: { actuelle: ev.actuelle as Cotation, cible: (ev.cible as Cotation | null) ?? null },
  })
  if (!t.ok) return NextResponse.json({ error: t.error }, { status: t.error === 'role_validateur_requis' || t.error === 'role_evaluateur_requis' ? 403 : 400 })
  const now = new Date()
  const data = action === 'SOUMETTRE' ? { statut: t.statut, evaluePar: c.ctx.userId, soumisLe: now }
    : action === 'VALIDER' ? { statut: t.statut, validePar: c.ctx.userId, valideLe: now }
      : { statut: t.statut }
  await prisma.evaluationUsageTiers.update({ where: { usageId }, data })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: c.ctx.userId, userRole: c.ctx.role, organizationId: c.ctx.orgId, ip: getClientIp(req), details: { scope: 'tier-registry', action: `usage-evaluation-${action.toLowerCase()}`, usageId } })
  return NextResponse.json({ ok: true, statut: t.statut })
}
