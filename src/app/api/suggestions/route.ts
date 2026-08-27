import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { analyseWhereClause, type UserRole } from '@/lib/permissions'
import { rankSuggestions, isSuggestionField } from '@/lib/suggestions'
import { tagsUniques } from '@/lib/analyse-tags'

export const dynamic = 'force-dynamic'

// GET /api/suggestions?field=organisation|tag&q=... — valeurs déjà saisies dans
// le périmètre visible de l'utilisateur, pour l'autocomplétion. Ne renvoie que
// des libellés issus des analyses que l'utilisateur peut déjà voir.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ suggestions: [] }, { status: 401 })

  const field = req.nextUrl.searchParams.get('field')
  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (!isSuggestionField(field)) return NextResponse.json({ suggestions: [] })

  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, userRole)
  const where = analyseWhereClause(userId, scope.role, scope.scope)

  let candidates: (string | null | undefined)[] = []
  if (field === 'organisation') {
    const rows = await (prisma.analyse as unknown as {
      findMany: (a: unknown) => Promise<{ organisation: string | null }[]>
    }).findMany({ where, select: { organisation: true }, take: 500 })
    candidates = rows.map(r => r.organisation)
  } else if (field === 'tag') {
    const rows = await (prisma.analyse as unknown as {
      findMany: (a: unknown) => Promise<{ tags: unknown }[]>
    }).findMany({ where, select: { tags: true }, take: 500 })
    candidates = tagsUniques(rows.map(r => ({ tags: Array.isArray(r.tags) ? (r.tags as string[]) : [] })))
  }

  return NextResponse.json({ suggestions: rankSuggestions(candidates, q) })
}
