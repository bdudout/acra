import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { analyseWhereClause, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/tiers/names — noms de tiers (parties prenantes) déjà connus dans les
 * analyses accessibles à l'utilisateur. Alimente l'auto-complétion à la saisie
 * (Atelier 3, issue #46 étape 1b). Scopé par les mêmes règles que /tiers.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const userId = (session.user as { id: string }).id
  const userRole: UserRole = (session.user as { role?: UserRole }).role ?? 'ANALYSTE'
  const { role, scope } = await getAnalyseScope(userId, userRole)

  const rows = await prisma.partiePrenante.findMany({
    where: { analyse: analyseWhereClause(userId, role, scope) },
    select: { nom: true },
    distinct: ['nom'],
    orderBy: { nom: 'asc' },
    take: 500,
  })
  const noms = [...new Set(rows.map(r => r.nom).filter(Boolean))]
  return NextResponse.json({ noms })
}
