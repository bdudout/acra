import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { resolvePageOrganizationIds } from '@/lib/org-context'
import PlansActionsView from '@/components/PlansActionsView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Plan d'action UNIFIÉ (source unique) : agrège mesures d'analyse (A5) et
// d'écosystème (A3), actions du registre, conformité, audit, régulateur,
// contrôle et incidents. Remplace l'ancienne page /actions (mesures seules) ;
// /plans-actions redirige ici.
// Liste paginée côté serveur (lot V1) : la vue interroge GET /api/actions avec les
// paramètres de l'URL (filtres, tri, page), deep-links historiques compris
// (?priorite=1 → CRITIQUE, ?filtre=retard, ?statut=EN_RETARD).
export default async function ActionsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, userRole)
  const orgIds = resolvePageOrganizationIds(scope.activeOrgId, scope.scope)
  if (!orgIds.length) redirect('/dashboard')

  // Sans organisation focalisée, le SUPER_ADMIN consulte un bilan consolidé,
  // strictement en lecture : l'édition d'une action orpheline reste liée à une
  // organisation active explicite (prop orgId ci-dessous).
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <PlansActionsView orgId={scope.activeOrgId ?? undefined} />
      </main>
    </div>
  )
}
