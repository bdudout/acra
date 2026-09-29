import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { getEffectiveScaleConfig } from '@/lib/configuration-server'
import Link from 'next/link'
import { Workflow } from 'lucide-react'
import { getServerT } from '@/lib/i18n'
import Cartographie from '@/components/Cartographie'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CartographiePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, userRole)
  const orgConfig = await getOrgConfig(scope.activeOrgId)
  if (!orgConfig.registreRisquesActive) redirect('/dashboard')
  // Matrice configurée (mêmes échelles/seuils que /configuration) pour une heat map fidèle.
  const scaleConfig = await getEffectiveScaleConfig(scope.activeOrgId)
  const t = await getServerT()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Processus de cartographie (démarche, périodicité de revue, statut). */}
        <div className="mb-3 flex justify-end">
          <Link href="/cartographie/processus" className="inline-flex items-center gap-1.5 text-sm text-ebios-700 hover:underline">
            <Workflow size={15} aria-hidden="true" />{t.processusCarto.linkLabel}
          </Link>
        </div>
        <Cartographie canPublish={userRole !== 'LECTEUR'} scaleConfig={scaleConfig} />
      </main>
    </div>
  )
}
