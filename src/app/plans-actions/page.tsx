import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { gatherActionItems } from '@/lib/action-items.server'
import PlansActionsView, { type SerializedActionItem } from '@/components/PlansActionsView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PlansActionsPage() {
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
  })

  // Sérialisation (Date → ISO) pour le passage au composant client.
  const serialized: SerializedActionItem[] = items.map((i) => ({
    ...i,
    echeance: i.echeance ? i.echeance.toISOString() : null,
  }))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <PlansActionsView items={serialized} />
      </main>
    </div>
  )
}
