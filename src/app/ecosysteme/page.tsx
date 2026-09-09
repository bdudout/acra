import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { prisma } from '@/lib/prisma'
import { type UserRole, analyseWhereClause } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import EcosystemFullView, { type FullTier } from '@/components/EcosystemFullView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Vue plein écran de l'écosystème : TOUS les tiers de toutes les analyses visibles,
// filtrables par entité/filiale (onglets) et par catégorie (chips). Contrairement
// au radar du tableau de bord, plafonné pour la lisibilité, cette page affiche tout.
export default async function EcosystemePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, userRole)
  const analyses = await prisma.analyse.findMany({
    where: analyseWhereClause(userId, scope.role, scope.scope),
    select: {
      id: true, nom: true, organisation: true, organizationId: true,
      organization: { select: { nom: true } },
      partiesPrenantes: { select: { id: true, nom: true, nomCourt: true, type: true, exposition: true, fiabilite: true, dependance: true, penetration: true, maturite: true, confiance: true, critique: true, rang: true, cle: true, parentCle: true } },
    },
  })

  const tiers: FullTier[] = analyses.flatMap(a =>
    a.partiesPrenantes.map(pp => ({
      id: pp.id, nom: pp.nom, nomCourt: pp.nomCourt ?? undefined, type: pp.type,
      exposition: pp.exposition, fiabilite: pp.fiabilite,
      dependance: pp.dependance, penetration: pp.penetration, maturite: pp.maturite, confiance: pp.confiance,
      critique: pp.critique, rang: pp.rang, cle: pp.cle ?? undefined, parentCle: pp.parentCle ?? undefined,
      orgId: a.organizationId ?? '__none', orgNom: a.organization?.nom ?? a.organisation ?? '—',
    }))
  )

  // Entités/filiales distinctes (onglets), triées par nombre de tiers décroissant.
  const orgMap = new Map<string, { id: string; nom: string; count: number }>()
  for (const tr of tiers) {
    const cur = orgMap.get(tr.orgId)
    if (cur) cur.count++
    else orgMap.set(tr.orgId, { id: tr.orgId, nom: tr.orgNom, count: 1 })
  }
  const orgs = [...orgMap.values()].sort((a, b) => b.count - a.count)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <EcosystemFullView tiers={tiers} orgs={orgs} />
      </main>
    </div>
  )
}
