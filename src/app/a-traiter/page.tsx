import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import Navbar from '@/components/Navbar'
import ATraiterClient from '@/components/ATraiterClient'
import { getServerT } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

// Page « À traiter » : ce qui attend la personne connectée (moteur des relances en aperçu, lib/relances.server).
export default async function ATraiterPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const t = await getServerT()
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main id="main-content" className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t.aTraiter.titre}</h1>
        <p className="mt-1 mb-5 text-sm text-gray-600 dark:text-gray-300">{t.aTraiter.intro}</p>
        <ATraiterClient />
      </main>
    </div>
  )
}
