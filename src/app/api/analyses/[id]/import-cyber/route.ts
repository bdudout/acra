// ─── Import de risques cyber dans une analyse projet 360 ─────────────────────
// GET  : analyses cyber sources possibles (recherche, liste légère) ; ?source= : risques d'une source.
// POST { sourceAnalyseId, risqueIds[], importerTiers? } : copie tracée en domaine CYBER, idempotente
//        par risque source ; tiers de la source recopiés sans doublon (oui par défaut).
// Gardes : cible = analyse PROJET_360 éditable et non gelée (guardDirectRisk) ; la
// source doit être accessible à l'utilisateur ET de la même organisation.
// Session (et rate limit du POST) : withAccess (org 'none') ; garde guardDirectRisk inchangée.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { SessionUser } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'
import { guardDirectRisk } from '@/lib/analyse-direct-risk.server'
import { sourcesCyberWhere } from '@/lib/projet360-sources.server'
import { getEffectiveScaleConfig } from '@/lib/configuration-server'
import { planCyberImport, planTiersImport } from '@/lib/projet360'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const SOURCE_RISK_SELECT = {
  id: true, nom: true, description: true, gravite: true, vraisemblance: true,
  graviteActuelle: true, vraisemblanceActuelle: true, graviteResiduelle: true, vraisemblanceResiduelle: true,
  strategie: true, proprietaire: true, taxonomieCode: true, niveauRisque: true,
} as const
const TIERS_SELECT = {
  nom: true, type: true, description: true, tierId: true, dependance: true, penetration: true, maturite: true, confiance: true, critique: true, rang: true,
} as const

async function context(id: string, user: SessionUser) {
  const role = user.role
  const g = await guardDirectRisk(id, user.id, role)
  if (!g.ok) return { ok: false as const, res: NextResponse.json({ error: g.error }, { status: g.status }) }
  if (g.analyse.methode !== 'PROJET_360') return { ok: false as const, res: NextResponse.json({ error: 'methode_non_360' }, { status: 400 }) }
  const organizationId = g.analyse.organizationId
  if (!organizationId) return { ok: false as const, res: NextResponse.json({ error: 'organisation_absente' }, { status: 400 }) }
  // La cible peut être dans une autre organisation que l'organisation active (filtre commun : lib/projet360-sources).
  const where = await sourcesCyberWhere(user.id, role, { id, organizationId })
  return { ok: true as const, userId: user.id, role, analyse: g.analyse, where }
}

// GET : sans paramètre ou avec ?q=…, liste LÉGÈRE des analyses sources (recherche par nom, 20 au plus, nombre de
// risques et de tiers) ; avec ?source=<id>, les risques de cette seule analyse (marqués « déjà importé »). On ne charge
// jamais tous les risques de toutes les analyses.
export const GET = withAccess({ org: 'none' }, async (req, { user, params }) => {
  const ctx = await context(params.id, user)
  if (!ctx.ok) return ctx.res
  const sp = req.nextUrl?.searchParams ?? new URLSearchParams()
  const sourceId = sp.get('source')
  if (sourceId) {
    const [source, imported] = await Promise.all([
      prisma.analyse.findFirst({
        where: { ...ctx.where, id: sourceId },
        select: { id: true, nom: true, methode: true, risques: { select: SOURCE_RISK_SELECT, orderBy: { niveauRisque: 'desc' } }, _count: { select: { partiesPrenantes: true } } },
      }),
      prisma.risque.findMany({ where: { analyseId: ctx.analyse.id, sourceRisqueId: { not: null } }, select: { sourceRisqueId: true } }),
    ])
    if (!source) return NextResponse.json({ error: 'Analyse source introuvable' }, { status: 404 })
    const done = new Set(imported.map(r => r.sourceRisqueId))
    const { _count, ...rest } = source
    return NextResponse.json({ source: { ...rest, nbTiers: _count.partiesPrenantes, risques: rest.risques.map(r => ({ ...r, alreadyImported: done.has(r.id) })) } })
  }
  const q = (sp.get('q') ?? '').trim().slice(0, 100)
  const sources = await prisma.analyse.findMany({
    where: { ...ctx.where, ...(q ? { nom: { contains: q, mode: 'insensitive' as const } } : {}) },
    select: { id: true, nom: true, methode: true, updatedAt: true, _count: { select: { risques: true, partiesPrenantes: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  })
  return NextResponse.json({ sources: sources.map(({ _count, ...a }) => ({ ...a, nbRisques: _count.risques, nbTiers: _count.partiesPrenantes })) })
})

export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'import-cyber' } }, async (req, { user, params }) => {
  const ctx = await context(params.id, user)
  if (!ctx.ok) return ctx.res
  const body = await req.json().catch(() => ({})) as { sourceAnalyseId?: unknown; risqueIds?: unknown; importerTiers?: unknown }
  const sourceAnalyseId = typeof body.sourceAnalyseId === 'string' ? body.sourceAnalyseId : ''
  const risqueIds = Array.isArray(body.risqueIds) ? body.risqueIds.filter((x): x is string => typeof x === 'string').slice(0, 500) : []
  // La source doit satisfaire le MÊME filtre que la liste (accès, organisation, méthode cyber).
  const source = sourceAnalyseId ? await prisma.analyse.findFirst({
    where: { ...ctx.where, id: sourceAnalyseId },
    select: { id: true, nom: true, risques: { select: SOURCE_RISK_SELECT }, partiesPrenantes: { select: TIERS_SELECT, orderBy: { createdAt: 'asc' } } },
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
  // Tiers de l'analyse source (demandé à l'import, oui par défaut) : même organisation, sans doublon.
  let tiers = 0
  if (body.importerTiers !== false && source.partiesPrenantes.length) {
    const existants = await prisma.partiePrenante.findMany({ where: { analyseId: ctx.analyse.id }, select: { nom: true, tierId: true } })
    const tiersRows = planTiersImport({ analyseId: ctx.analyse.id, source: source.partiesPrenantes, existants })
    if (tiersRows.length) tiers = (await prisma.partiePrenante.createMany({ data: tiersRows })).count
  }
  await auditLog('WORKSHOP_SAVED', {
    userId: ctx.userId, userRole: ctx.role, organizationId: ctx.analyse.organizationId, targetId: ctx.analyse.id, targetType: 'analyse',
    ip: getClientIp(req), details: { scope: 'import-cyber', sourceAnalyseId: source.id, imported: result.count, tiers },
  })
  return NextResponse.json({ imported: result.count, tiers }, { status: 201 })
})
