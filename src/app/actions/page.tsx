import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { analyseWhereClause, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getServerT, getServerLocale } from '@/lib/i18n'
import ActionsClient, { type MesureRow } from '@/components/ActionsClient'
import { prioriteRank } from '@/lib/ecosystem-measures'

// Désactiver le cache Next.js pour toujours afficher les données fraîches
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  searchParams: Promise<{ priorite?: string; filtre?: string }>
}

export default async function ActionsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')

  const t = await getServerT()
  const locale = await getServerLocale()
  const userId = (session.user as any).id
  const userRole: UserRole = (session.user as any).role ?? 'ANALYSTE'
  const __org = await getAnalyseScope(userId, userRole)

  const { priorite, filtre } = await searchParams
  const now = new Date()

  // Récupérer toutes les analyses accessibles avec leurs mesures
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analyses = await (prisma.analyse.findMany as any)({
    where: analyseWhereClause(userId, __org.role, __org.scope),
    select: {
      id: true,
      nom: true,
      organisation: true,
      mesures: {
        select: {
          id:          true,
          nom:         true,
          description: true,
          type:        true,
          priorite:    true,
          statut:      true,
          responsable: true,
          echeance:    true,
          entite:      true,
          risqueId:    true,
        },
        orderBy: [{ priorite: 'asc' }, { statut: 'asc' }],
      },
      scenariosStrategiques: { select: { mesuresEcosysteme: true } },
    },
    orderBy: { updatedAt: 'desc' },
  }) as Array<{
    id: string; nom: string; organisation: string | null;
    mesures: Array<{
      id: string; nom: string; description: string | null; type: string;
      priorite: number; statut: string; responsable: string | null;
      entite: string | null; echeance: Date | null; risqueId: string | null;
    }>
    scenariosStrategiques: Array<{ mesuresEcosysteme: unknown }>
  }>

  // Aplatir les mesures A5 (plan d'action)
  const mesuresA5: MesureRow[] = analyses.flatMap(a =>
    a.mesures.map(m => ({
      mesureId:    m.id,
      analyseId:   a.id,
      analyseNom:  a.nom,
      analyseOrg:  a.organisation,
      nom:         m.nom,
      description: m.description,
      type:        m.type,
      priorite:    m.priorite,
      statut:      m.statut,
      responsable: m.responsable,
      entite:      m.entite ?? null,
      echeance:    m.echeance ? m.echeance.toISOString() : null,
      enRetard:    m.statut !== 'REALISE' && m.echeance !== null && m.echeance < now,
      source:      'a5' as const,
      partiePrenante: null,
    }))
  )

  // Mesures d'écosystème (Atelier 3), stockées en JSON sur les scénarios stratégiques.
  // Priorité 'P1'…'P4' (string) → nombre ; pas d'échéance/responsable ; taguées au tiers.
  const mesuresEco: MesureRow[] = analyses.flatMap(a =>
    (a.scenariosStrategiques ?? []).flatMap(sc => {
      const list = Array.isArray(sc.mesuresEcosysteme) ? (sc.mesuresEcosysteme as any[]) : []
      return list.map(m => ({
        mesureId:    `eco-${String(m?.id ?? Math.random().toString(36).slice(2))}`,
        analyseId:   a.id,
        analyseNom:  a.nom,
        analyseOrg:  a.organisation,
        nom:         String(m?.mesure ?? ''),
        description: m?.description ? String(m.description) : null,
        type:        String(m?.type ?? 'ORGANISATIONNELLE'),
        priorite:    prioriteRank(m?.priorite) < 4 ? prioriteRank(m?.priorite) + 1 : 3,
        statut:      String(m?.statut ?? 'A_FAIRE'),
        responsable: null,
        entite:      null,
        echeance:    null,
        enRetard:    false,
        source:      'ecosysteme' as const,
        partiePrenante: m?.partiePrenante ? String(m.partiePrenante) : null,
      }))
    })
  ).filter(m => m.nom.trim().length > 0)

  const allMesures: MesureRow[] = [...mesuresA5, ...mesuresEco]

  // Trier : priorité croissante, puis en retard en premier, puis statut
  allMesures.sort((a, b) => {
    if (a.priorite !== b.priorite) return a.priorite - b.priorite
    if (a.enRetard !== b.enRetard) return a.enRetard ? -1 : 1
    return a.statut.localeCompare(b.statut)
  })

  // Appliquer le filtre priorité (URL param)
  let activePriorite = 'all'
  let filtered = allMesures

  if (priorite === '1') { filtered = allMesures.filter(m => m.priorite === 1); activePriorite = 'p1' }
  else if (priorite === '2') { filtered = allMesures.filter(m => m.priorite === 2); activePriorite = 'p2' }
  else if (priorite === '3') { filtered = allMesures.filter(m => m.priorite === 3); activePriorite = 'p3' }
  else if (filtre === 'retard') { filtered = allMesures.filter(m => m.enRetard); activePriorite = 'retard' }

  // Compteurs
  const counts = {
    all:    allMesures.length,
    p1:     allMesures.filter(m => m.priorite === 1).length,
    p2:     allMesures.filter(m => m.priorite === 2).length,
    p3:     allMesures.filter(m => m.priorite === 3).length,
    retard: allMesures.filter(m => m.enRetard).length,
  }

  // Toutes les entités uniques (pour le filtre client)
  const allEntites = Array.from(
    new Set(allMesures.map(m => m.entite).filter((e): e is string => !!e))
  ).sort()

  // Tous les prestataires uniques (mesures d'écosystème) pour le filtre client
  const allPrestataires = Array.from(
    new Set(allMesures.map(m => m.partiePrenante).filter((p): p is string => !!p))
  ).sort()

  const FILTERS_PRIORITE = [
    { key: 'all',    href: '/actions',                    label: t.actions.filterAll,    count: counts.all,    active: 'bg-gray-100 text-gray-800' },
    { key: 'p1',     href: '/actions?priorite=1',          label: t.actions.filterP1,     count: counts.p1,     active: 'bg-red-100 text-red-800' },
    { key: 'p2',     href: '/actions?priorite=2',          label: t.actions.filterP2,     count: counts.p2,     active: 'bg-orange-100 text-orange-800' },
    { key: 'p3',     href: '/actions?priorite=3',          label: t.actions.filterP3,     count: counts.p3,     active: 'bg-yellow-100 text-yellow-800' },
    { key: 'retard', href: '/actions?filtre=retard',       label: t.actions.filterRetard, count: counts.retard, active: 'bg-amber-100 text-amber-800' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">

        {/* En-tête */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">🛡️ {t.actions.title}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{t.actions.subtitle}</p>
          </div>
        </div>

        {/* Filtres par priorité */}
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs text-gray-500 self-center font-medium uppercase tracking-wide w-full sm:w-auto">{t.actions.priorityLabel}</span>
          {FILTERS_PRIORITE.map(f => (
            <Link
              key={f.key}
              href={f.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activePriorite === f.key
                  ? `${f.active} border-transparent shadow-sm`
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {f.label}
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                activePriorite === f.key ? 'bg-white/60' : 'bg-gray-100'
              }`}>
                {f.count}
              </span>
            </Link>
          ))}
        </div>

        {/* Table + recherche + filtres (client) */}
        <ActionsClient
          mesures={filtered}
          total={allMesures.length}
          allEntites={allEntites}
          statutLabels={t.actions.statut}
          typeLabels={t.actions.type}
          colAnalyse={t.actions.colAnalyse}
          colMesure={t.actions.colMesure}
          colType={t.actions.colType}
          colPriorite={t.actions.colPriorite}
          colStatut={t.actions.colStatut}
          colResponsable={t.actions.colResponsable}
          colEntite={t.actions.colEntite}
          colEcheance={t.actions.colEcheance}
          goToAtelier={t.actions.goToAtelier}
          noActions={t.actions.noActions}
          retard={t.actions.retard}
          filterStatutLabel={t.actions.filterStatutLabel}
          filterEntiteLabel={t.actions.filterEntiteLabel}
          filterEcheanceLabel={t.actions.filterEcheanceLabel}
          filterAllStatuts={t.actions.filterAllStatuts}
          filterAllEntites={t.actions.filterAllEntites}
          echeanceRetard={t.actions.echeanceRetard}
          echeanceSemaine={t.actions.echeanceSemaine}
          echeanceMois={t.actions.echeanceMois}
          echeanceSans={t.actions.echeanceSans}
          searchPh={t.actions.searchPh}
          resultCount={t.actions.resultCount}
          locale={locale}
          clearLabel={t.actions.clearFilters}
          clearSearchLabel={t.actions.clearSearch}
          sourceEcoLabel={t.actions.sourceEco}
          allPrestataires={allPrestataires}
          filterSourceLabel={t.actions.filterSourceLabel}
          filterAllSources={t.actions.filterAllSources}
          sourceA5Label={t.actions.sourceA5}
          filterPrestataireLabel={t.actions.filterPrestataireLabel}
          filterAllPrestataires={t.actions.filterAllPrestataires}
        />
      </main>
    </div>
  )
}
