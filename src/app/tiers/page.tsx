import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Navbar from '@/components/Navbar'
import { analyseWhereClause, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getServerT } from '@/lib/i18n'
import { menace, zoneOf } from '@/lib/ecosystem-radar'
import { consolidateTiers } from '@/lib/tiers'
import TiersClient, { type TiersRow } from '@/components/TiersClient'

// Toujours afficher des données fraîches
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function TiersPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')

  const t = await getServerT()
  const userId = (session.user as any).id
  const userRole: UserRole = (session.user as any).role ?? 'ANALYSTE'
  const __org = await getAnalyseScope(userId, userRole)

  // Parties prenantes (écosystème) de toutes les analyses accessibles
  const analyses = await prisma.analyse.findMany({
    where: analyseWhereClause(userId, __org.role, __org.scope),
    select: {
      id: true,
      nom: true,
      organisation: true,
      organization: { select: { nom: true } },
      partiesPrenantes: {
        select: {
          id: true, nom: true, type: true, description: true,
          exposition: true, fiabilite: true,
          dependance: true, penetration: true, maturite: true, confiance: true,
          critique: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Vue consolidée : périmètre couvrant plusieurs organisations → entité d'origine.
  const consolidated = (__org.scope.visibleOrgIds?.length ?? 0) > 1

  const tiers: TiersRow[] = analyses.flatMap(a =>
    a.partiesPrenantes.map(pp => {
      const m = menace(pp.exposition, pp.fiabilite)
      return {
        id:          pp.id,
        analyseId:   a.id,
        analyseNom:  a.nom,
        analyseOrg:  a.organisation,
        entite:      consolidated ? (a.organization?.nom ?? null) : null,
        nom:         pp.nom,
        type:        pp.type,
        description: pp.description,
        exposition:  pp.exposition,
        fiabilite:   pp.fiabilite,
        dependance:  pp.dependance,
        penetration: pp.penetration,
        maturite:    pp.maturite,
        confiance:   pp.confiance,
        critique:    pp.critique,
        menace:      m,
        zone:        zoneOf(m),
      }
    })
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">🤝 {t.tiers.title}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{t.tiers.subtitle}</p>
          </div>
        </div>

        <TiersClient tiers={consolidateTiers(tiers)} />
      </main>
    </div>
  )
}
