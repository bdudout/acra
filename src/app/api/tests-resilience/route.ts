// ─── Programme de tests de résilience opérationnelle numérique (DORA) ────────
// GET ?annee= : tests de l'année + indicateurs du programme + années disponibles.
// POST : ajoute un test (rôles d'évaluation DORA). Module inactif → 404.

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { testsResilienceContext, scopeLinks, TEST_SELECT, toLite } from '@/lib/tests-resilience.server'
import { sanitizeTestResilience, programmeStats } from '@/lib/tests-resilience'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

const refus = (status: number) => NextResponse.json({ error: status === 401 ? 'Non autorisé' : status === 403 ? 'Accès refusé' : 'Introuvable' }, { status })

export async function GET(req: NextRequest) {
  const access = await testsResilienceContext()
  if (!access.ok) return refus(access.status)
  const { ctx } = access
  const now = new Date()
  const annee = Number(req.nextUrl.searchParams.get('annee')) || now.getUTCFullYear()
  const rows = await prisma.testResilience.findMany({ where: { organizationId: ctx.orgId }, select: TEST_SELECT, orderBy: [{ annee: 'desc' }, { datePrevue: 'asc' }] })
  const lites = rows.map(toLite)
  const annees = [...new Set([now.getUTCFullYear(), ...rows.map(r => r.annee)])].sort((a, b) => b - a)
  return NextResponse.json({
    annee, annees, canWrite: ctx.canWrite,
    tests: rows.filter(r => r.annee === annee),
    stats: programmeStats(lites, annee, now),
  })
}

export async function POST(req: NextRequest) {
  const access = await testsResilienceContext()
  if (!access.ok) return refus(access.status)
  const { ctx } = access
  if (!ctx.canWrite) return refus(403)
  const rl = await rateLimit(`tests-resilience:${ctx.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  const parsed = sanitizeTestResilience(await req.json().catch(() => ({})))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const links = await scopeLinks(ctx.orgId, parsed.value.riskItemIds, parsed.value.processusId)
  const created = await prisma.testResilience.create({
    data: { ...parsed.value, ...links, constats: parsed.value.constats as unknown as Prisma.InputJsonValue, organizationId: ctx.orgId, createdById: ctx.userId },
    select: TEST_SELECT,
  })
  await auditLog('ADMIN_ACTION', { userId: ctx.userId, userRole: ctx.role, organizationId: ctx.orgId, ip: getClientIp(req), targetId: created.id, targetType: 'test-resilience', details: { action: 'create', type: created.type, annee: created.annee } })
  return NextResponse.json({ test: created }, { status: 201 })
}
