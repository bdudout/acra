import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import type { UserRole } from '@/lib/permissions'
import Navbar from '@/components/Navbar'
import AuditPlanView from '@/components/AuditPlanView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AuditPlanPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId || !(await getOrgConfig(scope.activeOrgId)).auditInterneActive) redirect('/dashboard')
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8"><AuditPlanView /></main>
    </div>
  )
}
