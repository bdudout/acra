import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import ProcessusManager from '@/components/ProcessusManager'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ProcessusPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  // Module « Registre de risques / Cartographie » requis (valeur effective : politique
  // d'instance appliquée). Sinon on n'expose pas la gestion des processus.
  const scope = await getAnalyseScope(userId, userRole)
  const orgConfig = await getOrgConfig(scope.activeOrgId)
  if (!orgConfig.registreRisquesActive) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <ProcessusManager canEdit={isAdminRole(userRole)} />
      </main>
    </div>
  )
}
