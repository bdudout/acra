import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { Gauge } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { getAnalyseScope } from '@/lib/org-context.server'
import { hasGlobalReadDispositif, type UserRole } from '@/lib/permissions'
import { getServerT, getServerLocale } from '@/lib/i18n'
import { loadRasRad } from '@/lib/ras-rad.server'
import Navbar from '@/components/Navbar'
import RasRadView from '@/components/RasRadView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Appétence au risque (RAS / RAD) : rôles à lecture globale du dispositif (comme le
// cockpit de pilotage) ; au moins une source (registre, KRI, maturité) active.
export default async function AppetencePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  if (!scope.activeOrgId || !hasGlobalReadDispositif(scope.role)) notFound()
  const [t, locale] = await Promise.all([getServerT(), getServerLocale()])
  const data = await loadRasRad(scope.activeOrgId, locale, t)
  if (!data.modules.registre && !data.modules.kri && !data.modules.maturite) notFound()
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100"><Gauge size={24} className="inline align-[-0.16em] mr-2 text-ebios-600" aria-hidden="true" />{t.appetence.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.appetence.subtitle}</p>
        </header>
        <RasRadView data={data} />
      </main>
    </div>
  )
}
