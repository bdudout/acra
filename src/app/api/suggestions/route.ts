import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { analyseWhereClause, type UserRole } from '@/lib/permissions'
import { rankSuggestions, isSuggestionField, extractJsonNames } from '@/lib/suggestions'
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any
  let candidates: (string | null | undefined)[] = []
  if (field === 'organisation') {
    const rows = await db.analyse.findMany({ where, select: { organisation: true }, take: 500 })
    candidates = rows.map((r: { organisation: string | null }) => r.organisation)
  } else if (field === 'tag') {
    const rows = await db.analyse.findMany({ where, select: { tags: true }, take: 500 })
    candidates = tagsUniques(rows.map((r: { tags: unknown }) => ({ tags: Array.isArray(r.tags) ? (r.tags as string[]) : [] })))
  } else if (field === 'entite') {
    // Entité (registre de risques) : org-scopée directement via organizationId.
    if (scope.activeOrgId) {
      const rows = await db.riskItem.findMany({ where: { organizationId: scope.activeOrgId }, select: { entite: true }, take: 1000 })
      candidates = rows.map((r: { entite: string | null }) => r.entite)
    }
  } else if (field === 'valeurMetier' || field === 'bienSupport') {
    // Champs stockés en JSON dans le Cadrage (tableau d'objets {nom,…}).
    const analyses = await db.analyse.findMany({ where, select: { id: true }, take: 1000 })
    const ids = analyses.map((a: { id: string }) => a.id)
    if (ids.length) {
      const col = field === 'valeurMetier' ? 'valeursMetier' : 'biensSupports'
      const rows = await db.cadrage.findMany({ where: { analyseId: { in: ids } }, select: { [col]: true }, take: 1000 })
      candidates = extractJsonNames(rows.map((r: Record<string, unknown>) => r[col]))
    }
  } else {
    // Champs portés par des tables liées (SourceRisque, PartiePrenante) : scopés
    // aux analyses VISIBLES de l'utilisateur via analyseId ∈ périmètre.
    const analyses = await db.analyse.findMany({ where, select: { id: true }, take: 1000 })
    const ids = analyses.map((a: { id: string }) => a.id)
    if (ids.length) {
      const table = field === 'sourceRisque' ? db.sourceRisque : field === 'mesure' ? db.mesure : db.partiePrenante
      const rows = await table.findMany({ where: { analyseId: { in: ids } }, select: { nom: true }, take: 1000 })
      candidates = rows.map((r: { nom: string | null }) => r.nom)
    }
  }

  return NextResponse.json({ suggestions: rankSuggestions(candidates, q) })
}
