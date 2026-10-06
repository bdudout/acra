import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { UserRole } from '@/lib/permissions'
import { getServerLocale } from '@/lib/i18n'
import { chargerVueProjet } from '@/lib/projet-vue.server'
import Navbar from '@/components/Navbar'
import ProjetPresentation from '@/components/projet360/ProjetPresentation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// /projets/[id] — présentation d'un projet 360 (indicateurs, validation, analyses cyber liées, export PowerPoint) ;
// « Modifier » ouvre les phases du projet. Chargement commun avec l'export : lib/projet-vue.server.
export default async function ProjetPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const { id } = await params
  const v = await chargerVueProjet(id, userId, instanceRole, await getServerLocale())
  if (!v) notFound()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        <ProjetPresentation canEdit={v.canEdit} canCreateCyber={v.canCreateCyber} validation={v.validation} projet={v.vue} />
      </main>
    </div>
  )
}
