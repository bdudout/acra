// Stratégies cyber / IT / résilience (docs/specs/strategie-cyber-it-resilience.md, lot S1b) : liste de l'organisation
// active. Lecture : rôles à lecture globale du dispositif (peutVoirStrategie) ; module `strategieActive` requis.
// Droits fins (rédiger, valider, rattacher) vérifiés par /api/strategies/**.
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutVoirStrategie, type UserRole } from '@/lib/permissions'
import Navbar from '@/components/Navbar'
import StrategiesListe from '@/components/strategie/StrategiesListe'
import { superAdminSansOrganisation } from '@/lib/choisir-organisation'
import ChoisirOrganisation from '@/components/ChoisirOrganisation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function StrategiesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  if (superAdminSansOrganisation(instanceRole, scope.activeOrgId)) return <ChoisirOrganisation />
  const role = (scope.role ?? instanceRole) as UserRole
  if (!scope.activeOrgId || !peutVoirStrategie(role)) redirect('/dashboard')
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.strategieActive) redirect('/dashboard')
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8"><StrategiesListe role={role} /></main>
    </div>
  )
}
