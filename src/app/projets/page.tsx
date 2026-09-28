import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { Briefcase } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { analyseWhereClause, canCreateAnalyse, type UserRole } from '@/lib/permissions'
import { getServerT } from '@/lib/i18n'
import Navbar from '@/components/Navbar'
import ProjetsManager from '@/components/ProjetsManager'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Onglet Projets (module « Projets 360 ») : analyses projet 360 de l'organisation
// active, visibles selon le périmètre de l'utilisateur ; lancement d'un projet.
export default async function ProjetsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  if (!scope.activeOrgId || !(await getOrgConfig(scope.activeOrgId)).projets360Active) notFound()
  const t = await getServerT()
  const rows = await prisma.analyse.findMany({
    where: { AND: [analyseWhereClause(userId, scope.role, scope.scope)], organizationId: scope.activeOrgId, methode: 'PROJET_360' },
    select: { id: true, nom: true, statut: true, updatedAt: true, _count: { select: { risques: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })
  const projets = rows.map(r => ({ id: r.id, nom: r.nom, statut: r.statut, risques: r._count.risques, updatedAt: r.updatedAt.toISOString() }))
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100"><Briefcase size={24} className="inline align-[-0.16em] mr-2 text-ebios-600" aria-hidden="true" />{t.projets.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.projets.subtitle}</p>
        </header>
        <ProjetsManager projets={projets} canCreate={canCreateAnalyse({ id: userId, role: scope.role })} />
      </main>
    </div>
  )
}
