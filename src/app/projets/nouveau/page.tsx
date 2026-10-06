import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig, optionsStructure } from '@/lib/org-config.server'
import { canCreateAnalyse, type UserRole } from '@/lib/permissions'
import Navbar from '@/components/Navbar'
import NouveauProjet360 from '@/components/NouveauProjet360'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// /projets/nouveau — lancement d'un projet 360 dans une page dédiée (comme /analyses/new), pour l'organisation active.
export default async function NouveauProjetPage({ searchParams }: { searchParams: Promise<{ analyse?: string }> }) {
  // Projet créé depuis une analyse cyber (« Associer un projet » › créer) : l'analyse lui sera liée.
  const analyseSource = (await searchParams).analyse || undefined
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) redirect('/projets')
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.projets360Active || !canCreateAnalyse({ id: userId, role: scope.role }, await optionsStructure(scope.activeOrgId))) redirect('/projets')
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main id="main-content" className="max-w-3xl mx-auto px-4 py-8">
        <NouveauProjet360 maxPatterns={cfg.patternsArchiMax} hiddenPatterns={cfg.patternsArchiMasques} analyseSourceId={analyseSource} />
      </main>
    </div>
  )
}
