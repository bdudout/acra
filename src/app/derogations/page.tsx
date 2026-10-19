import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { getServerLocale } from '@/lib/i18n'
import DerogationsRegistre from '@/components/DerogationsRegistre'
import { chargerRegistreDerogations } from '@/lib/derogations-registre.server'
import DerogationsDashboard from '@/components/DerogationsDashboard'
import { getServerTOrg } from '@/lib/i18n-org'
import { buildDerogationDashboard } from '@/lib/derogation-dashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DerogationsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')

  const locale = await getServerLocale()
  const userId = (session.user as { id: string }).id
  const userRole: UserRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, userRole)
  const t = await getServerTOrg(scope.activeOrgId) // vocabulaire de l'organisation (lot L5)

  // Tableau de bord : calculé ici sur tout le registre visible ; les lignes sont chargées page par page
  // par le registre (GET /api/derogations?page=…, lot V1), mêmes règles de visibilité.
  const rows = await chargerRegistreDerogations(userId, scope.role, scope.scope)

  // Peut créer une dérogation autonome : rôle porteur + fonctionnalité active sur l'org active.
  const activeConfig = scope.activeOrgId ? await getOrgConfig(scope.activeOrgId) : null
  const canCreate = userRole !== 'LECTEUR' && userRole !== 'DIRECTION_METIER' && !!activeConfig?.derogationsActive

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <DerogationsDashboard dashboard={buildDerogationDashboard(rows, activeConfig?.derogationAlerteJours ?? 30)} labels={{ title: t.derogations.title, active: t.derogations.filterCurrent, expiringSoon: t.derogations.filterDue, expired: t.derogations.filterExpired, pending: t.derogations.filterReview }} />
        <DerogationsRegistre locale={locale} canCreate={canCreate}
          dureeDefaut={activeConfig?.derogationDureeDefautJours ?? 180}
          dureeMax={activeConfig?.derogationDureeMaxJours ?? 365}
          userId={userId} userRole={scope.role} secondeLigneActive={activeConfig?.secondeLigneActive ?? true} petiteStructure={activeConfig?.petiteStructure ?? false} />
      </main>
    </div>
  )
}
