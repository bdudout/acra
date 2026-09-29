import { notFound, redirect } from 'next/navigation'
import { Gauge } from 'lucide-react'
import { getServerT, getServerLocale } from '@/lib/i18n'
import { maturityContext, maturityReferentiels, loadMaturityProfile, orgMaturityScale } from '@/lib/maturity.server'
import Navbar from '@/components/Navbar'
import MaturityDashboard from '@/components/MaturityDashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Maturité (profils cibles CMMI) : couche des suivis de conformité. Module inactif
// ou sans organisation active → 404, comme les routes /api/maturite.
export default async function MaturitePage({ searchParams }: { searchParams: Promise<{ referentiel?: string }> }) {
  const access = await maturityContext()
  if (!access.ok) {
    if (access.status === 401) redirect('/auth/signin')
    notFound()
  }
  const { ctx } = access
  const [t, locale, { referentiel: requested }] = await Promise.all([getServerT(), getServerLocale(), searchParams])
  const referentiels = await maturityReferentiels(ctx.orgId, locale)
  const m = t.maturite
  // Défaut : NIST CSF puis NCSC CAF s'ils sont actifs, sinon le premier référentiel.
  const code = referentiels.find(r => r.code === requested)?.code
    ?? referentiels.find(r => r.code === 'NIST_CSF')?.code ?? referentiels.find(r => r.code === 'NCSC_CAF')?.code ?? referentiels[0]?.code
  const [profile, scale] = code
    ? await Promise.all([loadMaturityProfile(ctx.orgId, code, locale), orgMaturityScale(ctx.orgId, t)])
    : [null, []]
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100"><Gauge size={24} className="inline align-[-0.16em] mr-2 text-ebios-600" aria-hidden="true" />{m.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{m.subtitle}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{m.manageHint}</p>
        </header>
        {profile
          ? <MaturityDashboard key={profile.referentiel} canManage={ctx.canManage} scale={scale} referentiels={referentiels} profile={profile} />
          : <div className="card p-6 text-sm text-gray-500">{t.conformiteSocle.aucunReferentiel}</div>}
      </main>
    </div>
  )
}
