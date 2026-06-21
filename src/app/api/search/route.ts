import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { analyseWhereClause, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { rateLimit, rateLimitHeaders, LIMIT_SEARCH } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId   = (session.user as any).id as string
  const userRole: UserRole = (session.user as any).role ?? 'ANALYSTE'
  const __org = await getAnalyseScope(userId, userRole)

  // Rate limiting : 60 requêtes / minute par utilisateur
  const rl = rateLimit(`search:${userId}`, LIMIT_SEARCH.limit, LIMIT_SEARCH.windowMs)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Trop de requêtes.' },
      { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) }
    )
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ analyses: [], risques: [], actions: [] })

  // Limiter la longueur de la recherche pour éviter les requêtes abusives
  if (q.length > 100) return NextResponse.json({ error: 'Requête trop longue' }, { status: 400 })

  const where = analyseWhereClause(userId, __org.role, __org.scope)

  const [analyses, risques, actions] = await Promise.all([
    // Analyses
    prisma.analyse.findMany({
      where: { ...where, nom: { contains: q, mode: 'insensitive' } },
      select: { id: true, nom: true, statut: true, organisation: true },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    }),
    // Risques
    prisma.risque.findMany({
      where: {
        nom: { contains: q, mode: 'insensitive' },
        analyse: where,
      },
      select: {
        id: true,
        nom: true,
        niveauRisque: true,
        analyseId: true,
        analyse: { select: { nom: true } },
      },
      take: 5,
      orderBy: { niveauRisque: 'desc' },
    }),
    // Actions (mesures)
    prisma.mesure.findMany({
      where: {
        nom: { contains: q, mode: 'insensitive' },
        analyse: where,
      },
      select: {
        id: true,
        nom: true,
        priorite: true,
        statut: true,
        analyseId: true,
        analyse: { select: { nom: true } },
      },
      take: 5,
      orderBy: { priorite: 'asc' },
    }),
  ])

  return NextResponse.json({ analyses, risques, actions })
}
