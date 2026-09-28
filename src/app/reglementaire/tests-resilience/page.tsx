import { notFound, redirect } from 'next/navigation'
import { ClipboardCheck } from 'lucide-react'
import { getServerT } from '@/lib/i18n'
import { testsResilienceContext } from '@/lib/tests-resilience.server'
import Navbar from '@/components/Navbar'
import TestsResilienceManager from '@/components/TestsResilienceManager'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Programme de tests de résilience opérationnelle numérique (DORA art. 24 à 26).
// Module « reporting réglementaire » inactif ou rôle sans lecture globale → 404.
export default async function TestsResiliencePage() {
  const access = await testsResilienceContext()
  if (!access.ok) {
    if (access.status === 401) redirect('/auth/signin')
    notFound()
  }
  const t = await getServerT()
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100"><ClipboardCheck size={24} className="inline align-[-0.16em] mr-2 text-ebios-600" aria-hidden="true" />{t.testsResilience.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.testsResilience.subtitle}</p>
        </header>
        <TestsResilienceManager />
      </main>
    </div>
  )
}
