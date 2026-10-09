import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { canManageRopa, isAdminRole, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import RgpdOnglets from '@/components/RgpdOnglets'
import { getOrgConfig } from '@/lib/org-config.server'

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
  // Registre du sous-traitant (art. 30 §2) : module activable, onglet affiché s'il est actif.
  const sousTraitant = scope.activeOrgId ? (await getOrgConfig(scope.activeOrgId)).ropaSousTraitantActive : false

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <RgpdOnglets sousTraitant={sousTraitant} estAdmin={isAdminRole(scope.role)} />
      </main>
    </div>
  )
}
