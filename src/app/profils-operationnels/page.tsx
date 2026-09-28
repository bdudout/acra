import { notFound, redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { getServerT } from '@/lib/i18n'
import { operationalProfileContext, loadOperationalProfiles } from '@/lib/operational-profiles.server'
import Navbar from '@/components/Navbar'
import OperationalProfilesEditor from '@/components/OperationalProfilesEditor'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Profils opérationnels US/UK : module optionnel (défaut inactif). Module inactif
// ou sans organisation active → 404, comme les routes API.
export default async function OperationalProfilesPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const access = await operationalProfileContext()
  if (!access.ok) {
    if (access.status === 401) redirect('/auth/signin')
    notFound()
  }
  const [t, profiles, { ref }] = await Promise.all([getServerT(), loadOperationalProfiles(access.ctx.orgId), searchParams])
  const o = t.operationalProfiles
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main id="main-content" className="max-w-5xl mx-auto px-4 py-8">
        <header className="mb-7">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100"><ShieldCheck size={24} className="inline align-[-0.16em] mr-2 text-ebios-600" aria-hidden="true" />{o.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{o.subtitle}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{o.manageHint}</p>
        </header>
        <OperationalProfilesEditor profiles={profiles} canManage={access.ctx.canManage} focusRef={typeof ref === 'string' ? ref.slice(0, 20) : undefined} />
      </main>
    </div>
  )
}
