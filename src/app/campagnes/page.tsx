import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import CampagnesManager from '@/components/CampagnesManager'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CampagnesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, userRole)
  const orgConfig = await getOrgConfig(scope.activeOrgId)
  // Les campagnes portent sur le registre : elles suivent le même module.
  if (!orgConfig.registreRisquesActive) redirect('/dashboard')

  // Piloter (ouvrir/valider/clôturer) = 2ᵉ ligne ; coter = 1ʳᵉ ligne.
  const canPilot = isAdminRole(userRole) || userRole === 'RISK_MANAGER' || userRole === 'RSSI'
  const canCote = userRole !== 'LECTEUR'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <CampagnesManager canPilot={canPilot} canCote={canCote} />
      </main>
    </div>
  )
}
