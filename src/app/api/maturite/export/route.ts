// ─── Export CSV du profil de maturité d'un référentiel ────────────────────────
// GET ?referentiel= : en-tête (organisation, référentiel, cible globale, maturité
// moyenne actuelle/cible, points sous la cible) puis un point par ligne. Cellules
// neutralisées (toCsvCell), rate limit d'export, journal EXPORT. Tout membre.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerLocale, getServerT } from '@/lib/i18n'
import { maturityContext, maturityReferentiels, loadMaturityProfile, orgMaturityScale } from '@/lib/maturity.server'
import { maturityCsvRows } from '@/lib/maturity'
import { toCsvCell } from '@/lib/spreadsheet-safe'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_EXPORT } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const access = await maturityContext()
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Non autorisé' : 'Introuvable' }, { status: access.status })
  const { ctx } = access
  const locale = await getServerLocale()
  const code = req.nextUrl.searchParams.get('referentiel') ?? ''
  const meta = (await maturityReferentiels(ctx.orgId, locale)).find(r => r.code === code)
  if (!meta) return NextResponse.json({ error: 'Référentiel invalide' }, { status: 400 })
  const rl = await rateLimit(`maturite-export:${ctx.userId}`, LIMIT_EXPORT.limit, LIMIT_EXPORT.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })

  const tAll = await getServerT()
  const t = tAll.maturite
  const [profile, scale, org] = await Promise.all([
    loadMaturityProfile(ctx.orgId, code, locale),
    orgMaturityScale(ctx.orgId, tAll),
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { nom: true, slug: true } }),
  ])
  const level = (n: number) => `${n} — ${scale.find(l => l.niveau === n)?.libelle ?? ''}`
  const line = (cells: unknown[]) => cells.map(toCsvCell).join(',')
  const s = profile.stats
  const lines = [
    line([t.csv.organisation, org?.nom ?? '']),
    line([t.csv.referentiel, meta.nom]),
    line([t.globalTarget, profile.maturiteCible !== null ? level(profile.maturiteCible) : t.noTarget]),
    line([t.stats.averageCurrent, s.averageCurrent ?? '']),
    line([t.stats.averageTarget, s.averageTarget ?? '']),
    line([t.stats.belowTarget, `${s.belowTarget}/${s.assessed}`]),
    line([t.disclaimer]),
    '',
    line([t.csv.domain, t.csv.ref, t.csv.label, t.current, t.target, t.csv.gap, t.owner, t.justification, t.lastChange]),
    ...maturityCsvRows(profile.items.map(i => ({ ...i, categorie: profile.categories[i.categorie] ?? i.categorie })), profile.maturites, profile.maturiteCible, level).map(line),
  ]
  await auditLog('EXPORT', {
    userId: ctx.userId, userRole: ctx.role, ip: getClientIp(req), organizationId: ctx.orgId,
    targetId: profile.conformiteId ?? undefined, targetType: 'maturite', details: { format: 'csv', referentiel: code },
  })
  const file = `maturite-${code.toLowerCase().replace(/[^a-z0-9-]/g, '')}-${(org?.slug ?? 'org').replace(/[^a-z0-9-]/gi, '')}.csv`
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${file}"` },
  })
}
