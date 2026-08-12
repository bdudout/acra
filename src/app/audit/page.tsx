import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import AuditManager from '@/components/AuditManager'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AuditPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, userRole)
  const orgConfig = await getOrgConfig(scope.activeOrgId)
  if (!orgConfig.auditInterneActive) redirect('/dashboard')

  // Cloisonnement 3ᵉ ligne : seul l'AUDITEUR (et l'admin) écrit ; les autres lisent.
  const canWrite = userRole === 'AUDITEUR' || isAdminRole(userRole)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <AuditManager canWrite={canWrite} />
      </main>
    </div>
  )
}
