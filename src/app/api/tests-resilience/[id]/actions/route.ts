// ─── Constat DORA → plan d'action unifié ────────────────────────────────────
// L'index est stable dans le constat JSON du test. Le lien polymorphe conserve
// l'origine exacte afin qu'un même constat ne génère jamais plusieurs actions ouvertes.

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { testsResilienceContext } from '@/lib/tests-resilience.server'
import { sanitizeConstats } from '@/lib/tests-resilience'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

type Params = { params: Promise<{ id: string }> }
const priority = (severity: number) => severity >= 4 ? 'CRITIQUE' : severity === 3 ? 'MAJEUR' : 'MODERE'

export async function POST(req: NextRequest, { params }: Params) {
  const access = await testsResilienceContext()
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Non autorisé' : 'Introuvable' }, { status: access.status })
  const { ctx } = access
  if (!ctx.canWrite) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const rl = await rateLimit(`tests-resilience-action:${ctx.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  const { id } = await params
  const test = await prisma.testResilience.findFirst({ where: { id, organizationId: ctx.orgId }, select: { id: true, intitule: true, constats: true } })
  if (!test) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const body = await req.json().catch(() => ({})) as { constatIndex?: unknown }
  const index = typeof body.constatIndex === 'number' && Number.isInteger(body.constatIndex) ? body.constatIndex : -1
  const constat = sanitizeConstats(test.constats)[index]
  if (!constat || constat.corrige) return NextResponse.json({ error: 'Constat non actionnable' }, { status: 400 })
  const ref = `constat:${index}`
  const existing = await prisma.planAction.findFirst({ where: { organizationId: ctx.orgId, statut: { not: 'FAIT' }, liens: { some: { type: 'TEST_RESILIENCE', targetId: test.id, ref } } }, select: { id: true, titre: true, statut: true } })
  if (existing) return NextResponse.json({ ...existing, existing: true })
  const action = await prisma.planAction.create({ data: {
    organizationId: ctx.orgId,
    titre: `DORA — ${test.intitule} : ${constat.description}`.slice(0, 200),
    description: constat.description,
    priorite: priority(constat.severite),
    createdById: ctx.userId,
    liens: { create: { type: 'TEST_RESILIENCE', targetId: test.id, ref, label: `${test.intitule} — constat ${index + 1}`.slice(0, 200) } },
  } })
  await auditLog('ADMIN_ACTION', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), targetId: action.id, targetType: 'plan-action', details: { action: 'promote-test-finding', testId: test.id, constatIndex: index, severite: constat.severite } })
  return NextResponse.json({ ...action, existing: false }, { status: 201 })
}

// PATCH — marque un constat corrigé (ou rouvert) : décision HUMAINE prise depuis la proposition de clôture quand toutes les
// actions liées sont faites. Org-scopé (404 hors organisation), rôles d'évaluation DORA, journalisé.
export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await testsResilienceContext()
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Non autorisé' : 'Introuvable' }, { status: access.status })
  const { ctx } = access
  if (!ctx.canWrite) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const rl = await rateLimit(`tests-resilience-action:${ctx.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  const { id } = await params
  const test = await prisma.testResilience.findFirst({ where: { id, organizationId: ctx.orgId }, select: { id: true, constats: true } })
  if (!test) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const body = await req.json().catch(() => ({})) as { constatIndex?: unknown; corrige?: unknown }
  const constats = sanitizeConstats(test.constats)
  const index = typeof body.constatIndex === 'number' && Number.isInteger(body.constatIndex) ? body.constatIndex : -1
  if (!constats[index] || typeof body.corrige !== 'boolean') return NextResponse.json({ error: 'Constat invalide' }, { status: 400 })
  const next = constats.map((c, i) => (i === index ? { ...c, corrige: body.corrige as boolean } : c))
  await prisma.testResilience.update({ where: { id }, data: { constats: next as unknown as Prisma.InputJsonValue } })
  await auditLog('ADMIN_ACTION', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), targetId: id, targetType: 'test-resilience', details: { action: 'constat-corrige', index, corrige: body.corrige } })
  return NextResponse.json({ ok: true, constats: next })
}
