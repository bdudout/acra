import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import IncidentsManager from '@/components/IncidentsManager'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function IncidentsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, userRole)
  const orgConfig = await getOrgConfig(scope.activeOrgId)
  if (!orgConfig.incidentsActive) redirect('/dashboard')

  // La déclaration est ouverte à tous (1ʳᵉ ligne) ; la qualification à la 2ᵉ ligne.
  // Qualification = 2ᵉ ligne ; en mode ligne unique, ouverte à la 1ʳᵉ ligne (sauf lecteur).
  const canQualify = orgConfig.secondeLigneActive === false
    ? userRole !== 'LECTEUR'
    : (isAdminRole(userRole) || userRole === 'RISK_MANAGER' || userRole === 'RSSI')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <IncidentsManager canQualify={canQualify} />
      </main>
    </div>
  )
}
