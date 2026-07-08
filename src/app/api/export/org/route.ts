import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { analyseWhereClause, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

/**
 * GET /api/export/org — export JSON de TOUTES les analyses accessibles à
 * l'utilisateur dans son périmètre (organisation). Utilisé par le bandeau démo
 * (« Exporter mes données ») pour récupérer l'intégralité du travail de test avant
 * purge, mais utile aussi hors démo. Réutilise la même forme que l'export unitaire.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: UserRole }).role ?? 'ANALYSTE') as UserRole

  const rl = rateLimit(`export:${userId}`, 20, 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Limite d\'export atteinte. Réessayez dans une heure.' },
      { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
    )
  }

  const scope = await getAnalyseScope(userId, userRole)
  const analyses = await prisma.analyse.findMany({
    where: analyseWhereClause(userId, scope.role, scope.scope),
    include: {
      cadrage: true,
      sourcesRisque: true,
      partiesPrenantes: true,
      scenariosStrategiques: true,
      scenariosOperationnels: true,
      risques: true,
      mesures: true,
      revisions: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const body = JSON.stringify({ exportedAt: new Date().toISOString(), count: analyses.length, analyses }, null, 2)
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="acra-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
