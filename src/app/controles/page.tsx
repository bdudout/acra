import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { peutDefinir2eLigne, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import ControlesManager from '@/components/ControlesManager'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ControlesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, userRole)
  const orgConfig = await getOrgConfig(scope.activeOrgId)
  if (!orgConfig.controlePermanentActive) redirect('/dashboard')

  // Définir le plan de contrôle = 2ᵉ ligne ; l'exécuter = 1ʳᵉ ligne (tous sauf LECTEUR).
  // Aligné sur le garde de l'API POST /api/controles (peutDefinir2eLigne).
  const canDefine = peutDefinir2eLigne(userRole)
  const canExecute = userRole !== 'LECTEUR'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <ControlesManager canDefine={canDefine} canExecute={canExecute} currentUserName={session.user.name ?? null} />
      </main>
    </div>
  )
}
