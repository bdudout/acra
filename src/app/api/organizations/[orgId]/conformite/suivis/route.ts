import { canReadOrgResource } from '@/lib/permissions'
/**
 * GET /api/organizations/[orgId]/conformite/suivis?referentiel=X — liste les SUIVIS
 * de conformité (org-wide + par entité/socle) d'un référentiel, avec leur taux.
 * Lecture : utilisateur dont le périmètre couvre l'organisation.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { type UserRole } from '@/lib/permissions'
import { getServerLocale } from '@/lib/i18n'
import { getExigencesFor } from '@/lib/referentiel.server'
import { sanitizeConformite, conformiteStats } from '@/lib/conformite'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ orgId: string }> }

// GET /api/organizations/[orgId]/conformite/suivis — historique des versions figées du taux de conformité (points de tendance) de l'org.
export async function GET(req: NextRequest, { params }: Params) {
  const { orgId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, userRole)
  if (!canReadOrgResource(orgId, scope.scope)) {
    return NextResponse.json({ error: 'Organisation hors périmètre' }, { status: 403 })
  }

  const referentiel = new URL(req.url).searchParams.get('referentiel') ?? ''
  if (!referentiel || referentiel === 'CUSTOM') return NextResponse.json({ suivis: [] })

  const locale = await getServerLocale()
  const total = (await getExigencesFor(referentiel, orgId, locale)).length
  const rows = await prisma.conformite.findMany({
    where: { organizationId: orgId, referentiel },
    select: { entite: true, nom: true, entries: true, updatedAt: true },
    orderBy: [{ entite: 'asc' }],
  })
  const suivis = rows.map(r => {
    const s = conformiteStats(sanitizeConformite(r.entries), total)
    return { entite: r.entite, nom: r.nom, taux: s.tauxConformite, evalues: s.evalues, total: s.total, updatedAt: r.updatedAt }
  })
  return NextResponse.json({ suivis, total })
}
