import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { gatherActionItems } from '@/lib/action-items.server'
import PlansActionsView, { type SerializedActionItem } from '@/components/PlansActionsView'
import type { ActionPriorite } from '@/lib/risk-action'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps { searchParams: Promise<{ priorite?: string; filtre?: string }> }

// Plan d'action UNIFIÉ (source unique) : agrège mesures d'analyse (A5) et
// d'écosystème (A3), actions du registre, conformité, audit, régulateur,
// contrôle et incidents. Remplace l'ancienne page /actions (mesures seules) ;
// /plans-actions redirige ici.
export default async function ActionsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, userRole)
  if (!scope.activeOrgId) redirect('/dashboard')
  const orgConfig = await getOrgConfig(scope.activeOrgId)

  const items = await gatherActionItems(scope.activeOrgId, {
    incidentsActive: orgConfig.incidentsActive,
    controlePermanentActive: orgConfig.controlePermanentActive,
    auditInterneActive: orgConfig.auditInterneActive,
    registreRisquesActive: orgConfig.registreRisquesActive,
    conformiteActive: orgConfig.conformiteActive,
  })

  const serialized: SerializedActionItem[] = items.map((i) => ({
    ...i,
    echeance: i.echeance ? i.echeance.toISOString() : null,
  }))

  // Deep-links historiques : /actions?priorite=1 (P1→CRITIQUE) ou ?filtre=retard.
  const { priorite, filtre } = await searchParams
  const initialPriorite: ActionPriorite | '' =
    priorite === '1' ? 'CRITIQUE' : priorite === '2' ? 'MAJEUR' : priorite === '3' ? 'MODERE' : ''
  const initialEcheance = filtre === 'retard' ? 'retard' : ''

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <PlansActionsView items={serialized} orgId={scope.activeOrgId} initialPriorite={initialPriorite} initialEcheance={initialEcheance} />
      </main>
    </div>
  )
}
