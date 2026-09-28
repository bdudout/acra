// ─── Export CSV du bilan d'un profil opérationnel ─────────────────────────────
// GET ?framework=NIST_CSF_2_0|NCSC_CAF_V4 : en-tête de contexte (organisation,
// cadre et version, niveau cible, couverture) puis un point par ligne. Cellules
// neutralisées contre l'injection de formule (toCsvCell), rate limit d'export,
// journal EXPORT. Lecture ouverte à tout membre de l'org (module actif).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerT } from '@/lib/i18n'
import { operationalProfileContext, loadOperationalProfiles } from '@/lib/operational-profiles.server'
import { OPERATIONAL_PROFILE_CATALOGS, isOperationalProfileFramework, operationalProfileCsvRows, type OperationalProfileStatus } from '@/lib/operational-profiles'
import { toCsvCell } from '@/lib/spreadsheet-safe'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_EXPORT } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const access = await operationalProfileContext()
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Non autorisé' : 'Introuvable' }, { status: access.status })
  const { ctx } = access
  const framework = req.nextUrl.searchParams.get('framework')
  if (!isOperationalProfileFramework(framework)) return NextResponse.json({ error: 'Référentiel de profil invalide' }, { status: 400 })
  const rl = await rateLimit(`operational-profile-export:${ctx.userId}`, LIMIT_EXPORT.limit, LIMIT_EXPORT.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })

  const t = (await getServerT()).operationalProfiles
  const catalog = OPERATIONAL_PROFILE_CATALOGS[framework]
  const [profile] = (await loadOperationalProfiles(ctx.orgId)).filter(p => p.framework === framework)
  const org = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { nom: true, slug: true } })
  const status = (s: OperationalProfileStatus) => (t.statuses as Record<string, string>)[s] ?? s
  const target = catalog.targetLevels.find(l => l.value === profile.cible)?.label ?? ''

  const line = (cells: unknown[]) => cells.map(toCsvCell).join(',')
  const lines = [
    line([t.csv.organisation, org?.nom ?? '']),
    line([t.csv.framework, `${catalog.title} — ${catalog.version}`]),
    line([t.targetLevel, target]),
    line([t.stats.coverage, `${profile.stats.coverage}%`]),
    line([t.stats.assessed, `${profile.stats.assessed}/${profile.stats.total}`]),
    line([t.csv.disclaimer]),
    '',
    line([t.csv.group, t.csv.ref, t.csv.label, t.current, t.target, t.owner, t.justification, t.lastChange]),
    ...operationalProfileCsvRows(framework, profile.entries, status).map(line),
  ]
  await auditLog('EXPORT', {
    userId: ctx.userId, userRole: ctx.role, ip: getClientIp(req), organizationId: ctx.orgId,
    targetId: profile.id ?? undefined, targetType: 'operational-profile', details: { format: 'csv', framework },
  })
  const file = `profil-${framework.toLowerCase()}-${(org?.slug ?? 'org').replace(/[^a-z0-9-]/gi, '')}.csv`
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${file}"` },
  })
}
