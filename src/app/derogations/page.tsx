import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Navbar from '@/components/Navbar'
import { analyseWhereClause, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getServerLocale } from '@/lib/i18n'
import DerogationsRegistre, { type RegistreRow } from '@/components/DerogationsRegistre'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DerogationsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')

  const locale = await getServerLocale()
  const userId = (session.user as { id: string }).id
  const userRole: UserRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, userRole)

  // Dérogations de toutes les analyses accessibles.
  const analyses = await prisma.analyse.findMany({
    where: analyseWhereClause(userId, scope.role, scope.scope),
    select: { id: true, nom: true },
  })
  const byId = new Map(analyses.map(a => [a.id, a.nom]))
  const derogations = await prisma.derogation.findMany({
    where: { analyseId: { in: analyses.map(a => a.id) } },
    orderBy: [{ statut: 'asc' }, { dateFin: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true, analyseId: true, portee: true, referentiel: true, ref: true,
      intitule: true, statut: true, dateFin: true, demandeurId: true,
    },
  })
  const rows: RegistreRow[] = derogations.map(d => ({
    id: d.id,
    analyseId: d.analyseId,
    analyseNom: byId.get(d.analyseId) ?? '—',
    portee: d.portee,
    referentiel: d.referentiel,
    ref: d.ref,
    intitule: d.intitule,
    statut: d.statut,
    dateFin: d.dateFin ? d.dateFin.toISOString() : null,
  }))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <DerogationsRegistre rows={rows} locale={locale} />
      </main>
    </div>
  )
}
