import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { canManageRopa, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import RopaManager from '@/components/RopaManager'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Registre des activités de traitement (RoPA — RGPD art. 30). Réservé au DPO (+ ADMIN).
export default async function RgpdPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, userRole)
  if (!canManageRopa(scope.role)) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <RopaManager />
      </main>
    </div>
  )
}
