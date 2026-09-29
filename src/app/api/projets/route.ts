import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { analyseWhereClause, type UserRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

// GET /api/projets — projets 360 de l'organisation active accessibles à l'utilisateur.
// Liste vide (et non 404) quand le module Projets 360 est inactif : le formulaire de
// création d'analyse s'en sert pour n'afficher « Partir d'un projet » que si utile.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const role = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, role)
  if (!scope.activeOrgId || !(await getOrgConfig(scope.activeOrgId)).projets360Active) return NextResponse.json({ projets: [] })
  const rows = await prisma.analyse.findMany({
    where: { AND: [analyseWhereClause(userId, scope.role, scope.scope)], organizationId: scope.activeOrgId, methode: 'PROJET_360', deletedAt: null },
    select: { id: true, nom: true, description: true },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ projets: rows })
}
