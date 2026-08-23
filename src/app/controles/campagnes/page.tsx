import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { peutDefinir2eLigne, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import CampagnesControleManager from '@/components/CampagnesControleManager'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CampagnesControlePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, instanceRole)
  const orgConfig = await getOrgConfig(scope.activeOrgId)
  // Campagnes rattachées au module Contrôle permanent.
  if (!orgConfig.controlePermanentActive) redirect('/dashboard')

  // Définition des campagnes = 2ᵉ ligne (pilotage du plan de contrôle).
  // Aligné sur le garde de l'API /api/controles/campagnes (peutDefinir2eLigne).
  const role = scope.role
  const canDefine = peutDefinir2eLigne(role)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <CampagnesControleManager canDefine={canDefine} />
      </main>
    </div>
  )
}
