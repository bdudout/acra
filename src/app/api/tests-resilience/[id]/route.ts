// ─── Test de résilience : mise à jour / suppression (org-scopé, 404 hors org) ─

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { testsResilienceContext, scopeLinks, TEST_SELECT, type TestsResilienceContext } from '@/lib/tests-resilience.server'
import { sanitizeTestResilience } from '@/lib/tests-resilience'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

type Params = { params: Promise<{ id: string }> }
const refus = (status: number) => NextResponse.json({ error: status === 401 ? 'Non autorisé' : status === 403 ? 'Accès refusé' : 'Introuvable' }, { status })

async function guard(req: NextRequest, params: Params['params']): Promise<{ res: NextResponse } | { ctx: TestsResilienceContext; id: string }> {
  const access = await testsResilienceContext()
  if (!access.ok) return { res: refus(access.status) }
  if (!access.ctx.canWrite) return { res: refus(403) }
  const rl = await rateLimit(`tests-resilience:${access.ctx.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return { res: NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) }) }
  const { id } = await params
  const existing = await prisma.testResilience.findFirst({ where: { id, organizationId: access.ctx.orgId }, select: { id: true } })
  if (!existing) return { res: refus(404) }
  return { ctx: access.ctx, id }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const g = await guard(req, params)
  if ('res' in g) return g.res
  const parsed = sanitizeTestResilience(await req.json().catch(() => ({})))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const links = await scopeLinks(g.ctx.orgId, parsed.value.riskItemIds, parsed.value.processusId)
  const updated = await prisma.testResilience.update({
    where: { id: g.id },
    data: { ...parsed.value, ...links, constats: parsed.value.constats as unknown as Prisma.InputJsonValue },
    select: TEST_SELECT,
  })
  await auditLog('ADMIN_ACTION', { userId: g.ctx.userId, userRole: g.ctx.role, organizationId: g.ctx.orgId, ip: getClientIp(req), targetId: g.id, targetType: 'test-resilience', details: { action: 'update', statut: updated.statut } })
  return NextResponse.json({ test: updated })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const g = await guard(req, params)
  if ('res' in g) return g.res
  await prisma.testResilience.delete({ where: { id: g.id } })
  await auditLog('ADMIN_ACTION', { userId: g.ctx.userId, userRole: g.ctx.role, organizationId: g.ctx.orgId, ip: getClientIp(req), targetId: g.id, targetType: 'test-resilience', details: { action: 'delete' } })
  return NextResponse.json({ ok: true })
}
