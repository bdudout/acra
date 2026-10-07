import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import type { UserRole } from '@/lib/permissions'
import { peutLireRapports } from '@/lib/rapport-acces'
import { rapportsDisponibles } from '@/lib/rapport-model'
import Navbar from '@/components/Navbar'
import RapportsManager from '@/components/RapportsManager'
import { superAdminSansOrganisation } from '@/lib/choisir-organisation'
import ChoisirOrganisation from '@/components/ChoisirOrganisation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Rapports GRC : éditions figées (incidents, pertes, synthèse direction).
export default async function RapportsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  // Super-administrateur en vue « toutes les organisations » : page propre à une organisation → message d'information.
  if (superAdminSansOrganisation(((session.user as { role?: string }).role), scope.activeOrgId)) return <ChoisirOrganisation />
  if (!scope.activeOrgId || !peutLireRapports(scope.role as UserRole)) redirect('/dashboard')
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (rapportsDisponibles(cfg).length === 0) redirect('/dashboard')
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="print:hidden"><Navbar /></div>
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8"><RapportsManager /></main>
    </div>
  )
}
