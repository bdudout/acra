import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { analyseWhereClause, type UserRole } from '@/lib/permissions'
import { portefeuille360 } from '@/lib/projet360-portefeuille'
import { buildPortefeuille360Xlsx } from '@/lib/projet360-portefeuille-xlsx'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_EXPORT } from '@/lib/rate-limit'
import { normalizePatterns, PATTERNS_MAX_MAX } from '@/lib/patterns-archi'

export const dynamic = 'force-dynamic'

// GET /api/projets/portefeuille — carte de chaleur domaine × projet des projets 360 de l'organisation active visibles par
// l'utilisateur (périmètre d'analyse). ?format=xlsx&lang= : export Excel (débit limité, journalisé).
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const role = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, role)
  const vide = NextResponse.json({ appetit: null, projets: [], projetsTries: [], totaux: {} })
  if (!scope.activeOrgId) return vide
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.projets360Active) return vide

  const xlsx = req.nextUrl.searchParams.get('format') === 'xlsx'
  // Un filtre inconnu ou malformé ne doit jamais élargir artificiellement la vue :
  // seuls les codes du référentiel sont conservés. `hasSome` correspond à une
  // recherche « l'un de ces patterns » — pratique pour identifier une surface
  // d'exposition, sans exclure les projets qui en combinent plusieurs.
  const patterns = normalizePatterns(req.nextUrl.searchParams.get('patterns')?.split(',') ?? [], { max: PATTERNS_MAX_MAX })
  if (xlsx) {
    const rl = await rateLimit(`projets-portefeuille:${userId}`, LIMIT_EXPORT.limit, LIMIT_EXPORT.windowMs)
    if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  }
  const rows = await prisma.analyse.findMany({
    where: {
      AND: [
        analyseWhereClause(userId, scope.role, scope.scope),
        ...(patterns.length ? [{ OR: patterns.map(pattern => ({ patternsArchi: { array_contains: pattern } })) }] : []),
      ],
      organizationId: scope.activeOrgId, methode: 'PROJET_360', deletedAt: null,
    },
    select: { id: true, nom: true, statut: true, risques: { select: { id: true, nom: true, domaine: true, niveauRisque: true, niveauResiduel: true }, take: 2000 } },
    orderBy: { updatedAt: 'desc' }, take: 200,
  })
  const p = portefeuille360(rows, cfg.appetitRisque?.seuilGlobal ?? null)
  if (!xlsx) return NextResponse.json(p)

  const lang = (['fr', 'en', 'de', 'es', 'it'].includes(req.nextUrl.searchParams.get('lang') ?? '') ? req.nextUrl.searchParams.get('lang') : 'fr') as 'fr'
  const org = await prisma.organization.findUnique({ where: { id: scope.activeOrgId }, select: { nom: true } })
  const buf = await buildPortefeuille360Xlsx(p, { lang, now: new Date(), organisation: org?.nom ?? '' })
  await auditLog('EXPORT', { userId, userRole: (scope.role ?? role) as string, organizationId: scope.activeOrgId, ip: getClientIp(req), targetType: 'projets-portefeuille', details: { format: 'xlsx', projets: rows.length } })
  return new NextResponse(buf as unknown as BodyInit, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="portefeuille-projets-360.xlsx"', 'Cache-Control': 'no-store' } })
}
