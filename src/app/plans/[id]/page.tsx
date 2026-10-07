// Programme pluriannuel d'audit et de contrôle (docs/specs/programme-audit-controle.md) : rôles à lecture globale du
// dispositif, avec l'audit interne ou le contrôle permanent actif ; droits fins vérifiés par /api/plans/**.
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { hasGlobalReadDispositif, type UserRole } from '@/lib/permissions'
import Navbar from '@/components/Navbar'
import PlanView from '@/components/plans/PlanView'
import { superAdminSansOrganisation } from '@/lib/choisir-organisation'
import ChoisirOrganisation from '@/components/ChoisirOrganisation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  // Super-administrateur en vue « toutes les organisations » : page propre à une organisation → message d'information.
  if (superAdminSansOrganisation(instanceRole, scope.activeOrgId)) return <ChoisirOrganisation />
  if (!scope.activeOrgId || !hasGlobalReadDispositif(scope.role as UserRole)) redirect('/dashboard')
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.auditInterneActive && !cfg.controlePermanentActive) redirect('/dashboard')
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8"><PlanView id={(await params).id} /></main>
    </div>
  )
}
