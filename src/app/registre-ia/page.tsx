import { getServerSession } from 'next-auth'
import { notFound, redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import Navbar from '@/components/Navbar'
import { peutGererRegistreIa, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import RegistreIaManager from '@/components/RegistreIaManager'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Registre des algorithmes et systèmes d'IA. Gouvernance seulement ; module registreIaActive requis (sinon 404).
export default async function RegistreIaPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, userRole)
  if (!peutGererRegistreIa(scope.role)) redirect('/dashboard')
  if (!scope.activeOrgId || !(await getOrgConfig(scope.activeOrgId)).registreIaActive) notFound()
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        <RegistreIaManager />
      </main>
    </div>
  )
}
