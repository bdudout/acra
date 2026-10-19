import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import { canCreateAnalyse, type UserRole } from '@/lib/permissions'
import { getOrgConfig, optionsStructure } from '@/lib/org-config.server'
import { getAnalyseScope } from '@/lib/org-context.server'
import { isDemoInstance } from '@/lib/demo-server'
import AnalysesClient from '@/components/AnalysesClient'

// Toujours des données fraîches (l'auth force déjà le rendu dynamique).
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Liste des analyses — droits et options calculés côté serveur ; les analyses sont chargées
 * page par page par la partie cliente (GET /api/analyses?page=…, lot V1 « grandes listes »),
 * avec la même clause de visibilité (analyseWhereClause).
 */
export default async function AnalysesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')

  const userId = (session.user as any).id
  const userRole: UserRole = (session.user as any).role ?? 'ANALYSTE'
  const scope = await getAnalyseScope(userId, userRole)
  const demo = await isDemoInstance()
  const projets360 = scope.activeOrgId ? (await getOrgConfig(scope.activeOrgId)).projets360Active : false
  const canCreate = canCreateAnalyse({ id: userId, role: scope.role ?? userRole }, await optionsStructure(scope.activeOrgId))

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">…</div>}>
        <AnalysesClient demo={demo} projets360={projets360} canCreate={canCreate} />
      </Suspense>
    </div>
  )
}
