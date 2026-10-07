import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getAnalyseScope } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import Navbar from '@/components/Navbar'
import PersonnalisationManager from '@/components/PersonnalisationManager'
import { superAdminSansOrganisation } from '@/lib/choisir-organisation'
import ChoisirOrganisation from '@/components/ChoisirOrganisation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Personnalisation de l'organisation (vocabulaire, champs, gabarits sectoriels) — ADMIN.
export default async function PersonnalisationPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  // Super-administrateur en vue « toutes les organisations » : page propre à une organisation → message d'information.
  if (superAdminSansOrganisation(((session.user as { role?: string }).role), scope.activeOrgId)) return <ChoisirOrganisation />
  if (!scope.activeOrgId || !isAdminRole(scope.role as UserRole)) redirect('/dashboard')
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main id="main-content" className="max-w-4xl mx-auto px-4 py-8"><PersonnalisationManager /></main>
    </div>
  )
}
