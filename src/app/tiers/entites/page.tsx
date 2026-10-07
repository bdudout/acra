import { Building2 } from 'lucide-react'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getServerT } from '@/lib/i18n'
import Navbar from '@/components/Navbar'
import TierIdentityPanel from '@/components/TierIdentityPanel'

export const dynamic = 'force-dynamic'

// /tiers/entites — entités de tiers (personnes morales) : liste, import depuis les services tiers, liens avec les services
// tiers et les contrats TIC. Droits et activation portés par /api/tier-registry (panneau masqué si inactif).
export default async function EntitesTiersPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const t = await getServerT()
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        <Link href="/tiers" className="text-sm text-ebios-700 hover:underline">{t.tiers.explication.retour}</Link>
        <h1 className="mt-2 mb-1 text-2xl font-bold text-gray-900"><Building2 size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" />{t.tiers.explication.bouton}</h1>
        <p className="mb-5 text-sm text-gray-500">{t.tierIdentity.hint}</p>
        <TierIdentityPanel sansTitre />
      </main>
    </div>
  )
}
