import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { analyseWhereClause, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getServerT } from '@/lib/i18n'
import { getRiskTier } from '@/lib/risk-scale'
import RisquesClient, { type RisqueRow } from '@/components/RisquesClient'

// Désactiver le cache Next.js pour toujours afficher les données fraîches
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  searchParams: Promise<{ niveau?: string }>
}

export default async function RisquesPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')

  const t = await getServerT()
  const userId = (session.user as any).id
  const userRole: UserRole = (session.user as any).role ?? 'ANALYSTE'
  const __org = await getAnalyseScope(userId, userRole)

  const { niveau } = await searchParams

  // Récupérer toutes les analyses accessibles avec leurs risques et mesures
  const analyses = await prisma.analyse.findMany({
    where: analyseWhereClause(userId, __org.role, __org.scope),
    select: {
      id: true,
      nom: true,
      organisation: true,
      organization: { select: { nom: true } },
      risques: {
        select: {
          id: true,
          nom: true,
          description: true,
          gravite: true,
          vraisemblance: true,
          niveauRisque: true,
          strategie: true,
          niveauResiduel: true,
        },
        orderBy: { niveauRisque: 'desc' },
      },
      mesures: {
        select: { id: true, risqueId: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Vue consolidée : périmètre couvrant plusieurs organisations → entité d'origine.
  const consolidated = (__org.scope.visibleOrgIds?.length ?? 0) > 1

  // Aplatir tous les risques avec leur contexte d'analyse
  const allRisques: RisqueRow[] = analyses.flatMap(a =>
    a.risques.map(r => ({
      analyseId:     a.id,
      analyseNom:    a.nom,
      analyseOrg:    a.organisation,
      entite:        consolidated ? (a.organization?.nom ?? null) : null,
      risqueId:      r.id,
      nom:           r.nom,
      description:   r.description,
      gravite:       r.gravite,
      vraisemblance: r.vraisemblance,
      niveauRisque:  r.niveauRisque,
      strategie:     r.strategie,
      niveauResiduel: r.niveauResiduel ?? null,
      mesuresCount:  a.mesures.filter(m => m.risqueId === r.id).length,
    }))
  )

  // Trier par criticité décroissante
  allRisques.sort((a, b) => b.niveauRisque - a.niveauRisque)

  // Appliquer le filtre niveau (URL param) — classification unique via getRiskTier
  const activeNiveau = niveau || 'all'
  let filtered = allRisques
  if (niveau === 'critique' || niveau === 'eleve' || niveau === 'modere' || niveau === 'faible') {
    filtered = allRisques.filter(r => getRiskTier(r.niveauRisque) === niveau)
  }

  // Compteurs par niveau
  const counts = {
    all:      allRisques.length,
    critique: allRisques.filter(r => getRiskTier(r.niveauRisque) === 'critique').length,
    eleve:    allRisques.filter(r => getRiskTier(r.niveauRisque) === 'eleve').length,
    modere:   allRisques.filter(r => getRiskTier(r.niveauRisque) === 'modere').length,
    faible:   allRisques.filter(r => getRiskTier(r.niveauRisque) === 'faible').length,
  }

  const FILTERS_NIVEAU = [
    { key: 'all',      href: '/risques',             label: t.risques.filterAll,      count: counts.all,      active: 'bg-gray-100 text-gray-800' },
    { key: 'critique', href: '/risques?niveau=critique', label: t.risques.filterCritique, count: counts.critique, active: 'bg-red-100 text-red-800' },
    { key: 'eleve',    href: '/risques?niveau=eleve',    label: t.risques.filterEleve,    count: counts.eleve,    active: 'bg-orange-100 text-orange-800' },
    { key: 'modere',   href: '/risques?niveau=modere',   label: t.risques.filterModere,   count: counts.modere,   active: 'bg-yellow-100 text-yellow-800' },
    { key: 'faible',   href: '/risques?niveau=faible',   label: t.risques.filterFaible,   count: counts.faible,   active: 'bg-green-100 text-green-800' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">

        {/* En-tête */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">⚠️ {t.risques.title}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{t.risques.subtitle}</p>
          </div>
        </div>

        {/* Filtres par niveau de risque */}
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs text-gray-500 self-center font-medium uppercase tracking-wide w-full sm:w-auto">{t.risques.levelLabel}</span>
          {FILTERS_NIVEAU.map(f => (
            <Link
              key={f.key}
              href={f.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeNiveau === f.key
                  ? `${f.active} border-transparent shadow-sm`
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {f.label}
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                activeNiveau === f.key ? 'bg-white/60' : 'bg-gray-100'
              }`}>
                {f.count}
              </span>
            </Link>
          ))}
        </div>

        {/* Table + recherche (client) */}
        <RisquesClient
          risques={filtered}
          total={allRisques.length}
          colAnalyse={t.risques.colAnalyse}
          colRisque={t.risques.colRisque}
          colScore={t.risques.colScore}
          colStrategie={t.risques.colStrategie}
          colResiduel={t.risques.colResiduel}
          colMesures={t.risques.colMesures}
          goToAtelier={t.risques.goToAtelier}
          noRisks={t.risques.noRisks}
          searchPh={t.risques.searchPh}
          countShown={t.risques.countShown}
          countShownFor={t.risques.countShownFor}
        />
      </main>
    </div>
  )
}
