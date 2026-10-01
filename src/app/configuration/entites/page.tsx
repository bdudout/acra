import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { getServerT } from '@/lib/i18n'
import { getAnalyseScope, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import EntitesRolesManager from '@/components/EntitesRolesManager'
import EntitySyncManager from '@/components/EntitySyncManager'
import PetiteStructureGuide from '@/components/PetiteStructureGuide'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Gestion des entités (sous-organisations) & rôles — réservé à l'ADMIN de l'org.
export default async function ConfigurationEntitesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, instanceRole)
  const orgId = scope.activeOrgId
  if (!orgId) redirect('/dashboard')
  // Rôle EFFECTIF dans l'org active : réservé à l'admin.
  const role = await getEffectiveRoleForOrg(userId, instanceRole, orgId)
  if (!role || !isAdminRole(role)) redirect('/configuration')

  const t = await getServerT()

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main id="main-content" className="max-w-5xl mx-auto px-4 py-8">
        <Link href="/configuration" className="text-sm text-ebios-600 hover:underline">← {t.config.title}</Link>
        <div className="mt-3">
          {/* Cumul des rôles RSSI / RM / analyste : expliqué là où l'on attribue les rôles. */}
          <div className="mb-6"><PetiteStructureGuide /></div>
          <EntitesRolesManager orgId={orgId} />
          <div className="mt-6"><EntitySyncManager orgId={orgId} /></div>
        </div>
      </main>
    </div>
  )
}
