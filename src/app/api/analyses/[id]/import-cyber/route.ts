// ─── Import de risques cyber dans une analyse projet 360 ─────────────────────
// GET  : analyses cyber sources possibles (même organisation, accessibles, méthode
//        cyber du registre, hors corbeille) et leurs risques, marqués « déjà importé ».
// POST { sourceAnalyseId, risqueIds[] } : copie tracée en domaine CYBER, idempotente
//        par risque source (contrainte unique analyse × risque source).
// Gardes : cible = analyse PROJET_360 éditable et non gelée (guardDirectRisk) ; la
// source doit être accessible à l'utilisateur ET de la même organisation.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/lib/permissions'
import { guardDirectRisk } from '@/lib/analyse-direct-risk.server'
import { analyseWhereClause } from '@/lib/permissions'
import { getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { getEffectiveScaleConfig } from '@/lib/configuration-server'
import { RISK_METHODS, METHOD_META } from '@/lib/methodes'
import { planCyberImport } from '@/lib/projet360'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

const CYBER_METHODS = RISK_METHODS.filter(m => METHOD_META[m].cyber)
const SOURCE_RISK_SELECT = {
  id: true, nom: true, description: true, gravite: true, vraisemblance: true,
  graviteActuelle: true, vraisemblanceActuelle: true, graviteResiduelle: true, vraisemblanceResiduelle: true,
  strategie: true, proprietaire: true, taxonomieCode: true, niveauRisque: true,
} as const

async function context(params: Params['params']) {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id?: string; role?: string } | undefined
  if (!user?.id) return { ok: false as const, res: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const role = (user.role ?? 'ANALYSTE') as UserRole
  const { id } = await params
  const g = await guardDirectRisk(id, user.id, role)
  if (!g.ok) return { ok: false as const, res: NextResponse.json({ error: g.error }, { status: g.status }) }
  if (g.analyse.methode !== 'PROJET_360') return { ok: false as const, res: NextResponse.json({ error: 'methode_non_360' }, { status: 400 }) }
  const organizationId = g.analyse.organizationId
  if (!organizationId) return { ok: false as const, res: NextResponse.json({ error: 'organisation_absente' }, { status: 400 }) }
  // La cible peut être dans une autre organisation que l'organisation active.
  // Une appartenance directe moins privilégiée y prime sur le rôle de session
  // ou sur une appartenance ancêtre. Sans appartenance, seules les analyses
  // explicitement possédées/partagées restent visibles.
  const targetRole = await getEffectiveRoleForOrg(user.id, role, organizationId)
  const where = {
    AND: [analyseWhereClause(user.id, targetRole ?? 'LECTEUR', {
      visibleOrgIds: [organizationId], isSuperAdmin: false,
    })],
    organizationId,
    methode: { in: CYBER_METHODS as string[] },
    deletedAt: null,
    NOT: { id },
  }
  return { ok: true as const, userId: user.id, role, analyse: g.analyse, where }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await context(params)
  if (!ctx.ok) return ctx.res
  const [sources, imported] = await Promise.all([
    prisma.analyse.findMany({
      where: ctx.where,
      select: { id: true, nom: true, methode: true, updatedAt: true, risques: { select: SOURCE_RISK_SELECT, orderBy: { niveauRisque: 'desc' } } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
    prisma.risque.findMany({ where: { analyseId: ctx.analyse.id, sourceRisqueId: { not: null } }, select: { sourceRisqueId: true } }),
  ])
  const done = new Set(imported.map(r => r.sourceRisqueId))
  return NextResponse.json({
    sources: sources.map(a => ({ ...a, risques: a.risques.map(r => ({ ...r, alreadyImported: done.has(r.id) })) })),
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const ctx = await context(params)
  if (!ctx.ok) return ctx.res
  const rl = await rateLimit(`import-cyber:${ctx.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  const body = await req.json().catch(() => ({})) as { sourceAnalyseId?: unknown; risqueIds?: unknown }
  const sourceAnalyseId = typeof body.sourceAnalyseId === 'string' ? body.sourceAnalyseId : ''
  const risqueIds = Array.isArray(body.risqueIds) ? body.risqueIds.filter((x): x is string => typeof x === 'string').slice(0, 500) : []
  // La source doit satisfaire le MÊME filtre que la liste (accès, organisation, méthode cyber).
  const source = sourceAnalyseId ? await prisma.analyse.findFirst({
    where: { ...ctx.where, id: sourceAnalyseId },
    select: { id: true, nom: true, risques: { select: SOURCE_RISK_SELECT } },
  }) : null
  if (!source) return NextResponse.json({ error: 'Analyse source introuvable' }, { status: 404 })

  const imported = await prisma.risque.findMany({ where: { analyseId: ctx.analyse.id, sourceRisqueId: { not: null } }, select: { sourceRisqueId: true } })
  const { nbNiveaux } = await getEffectiveScaleConfig(ctx.analyse.organizationId)
  const rows = planCyberImport({
    sourceAnalyseId: source.id, source: source.risques, selectedIds: risqueIds,
    alreadyImported: imported.flatMap(r => (r.sourceRisqueId ? [r.sourceRisqueId] : [])), maxNiveau: nbNiveaux,
  })
  const result = rows.length === 0 ? { count: 0 } : await prisma.risque.createMany({
    skipDuplicates: true,
    data: rows.map(({ vulnerabilites: _v, ...r }) => { void _v; return { ...r, analyseId: ctx.analyse.id, strategie: r.strategie } }),
  })
  await auditLog('WORKSHOP_SAVED', {
    userId: ctx.userId, userRole: ctx.role, organizationId: ctx.analyse.organizationId, targetId: ctx.analyse.id, targetType: 'analyse',
    ip: getClientIp(req), details: { scope: 'import-cyber', sourceAnalyseId: source.id, imported: result.count },
  })
  return NextResponse.json({ imported: result.count }, { status: 201 })
}
