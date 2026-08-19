import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import RegistreTicManager from '@/components/RegistreTicManager'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function RegistreTicPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, instanceRole)
  const orgConfig = await getOrgConfig(scope.activeOrgId)
  // Registre rattaché au module Reporting réglementaire.
  if (!orgConfig.reglementaireActive) redirect('/dashboard')

  // Tenue du registre = 2ᵉ ligne (gouvernance / conformité).
  const role = scope.role
  const canManage = isAdminRole(role) || role === 'RSSI' || role === 'RISK_MANAGER' || role === 'CONFORMITE' || role === 'DPO'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <RegistreTicManager canManage={canManage} />
      </main>
    </div>
  )
}
