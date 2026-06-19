import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { ATELIERS_META } from '@/lib/ebios-data'
import { getRiskTier } from '@/lib/risk-scale'
import AnalysesChart from '@/components/AnalysesChart'
import EcosystemRadar from '@/components/EcosystemRadar'
import EbiosGuide from '@/components/EbiosGuide'
import ExpressAnalyseButton from '@/components/ExpressAnalyseButton'
import { analyseWhereClause, canCreateAnalyse, type UserRole } from '@/lib/permissions'
import { getServerT, getServerLocale } from '@/lib/i18n'
import { formatDate } from '@/lib/format'
import { ClipboardList, Send, Settings, CheckCircle2, AlertCircle, AlertTriangle, KeyRound } from 'lucide-react'

// Désactiver le cache Next.js pour toujours afficher les données fraîches
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')

  const t = await getServerT()
  const locale = await getServerLocale()
  const userId = (session.user as any).id
  const userRole: UserRole = (session.user as any).role ?? 'ANALYSTE'

  const analyses = await prisma.analyse.findMany({
    where: analyseWhereClause(userId, userRole),
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { sourcesRisque: true, scenariosStrategiques: true, risques: true, mesures: true } },
      risques: { select: { niveauRisque: true, niveauResiduel: true, strategie: true } },
      mesures: { select: { statut: true, priorite: true } },
      partiesPrenantes: { select: { id: true, nom: true, nomCourt: true, type: true, exposition: true, fiabilite: true, dependance: true, penetration: true, maturite: true, confiance: true, critique: true } },
    },
  })

  // Liste des analyses récentes (par date) — limitée à 3
  const recent = analyses.slice(0, 3)

  // Vue d'ensemble : max 6 analyses, classées par criticité (critiques, puis majeurs…)
  const tierCount = (a: typeof analyses[number], tier: string) =>
    a.risques.filter(r => getRiskTier(r.niveauRisque) === tier).length
  const overviewAnalyses = [...analyses].sort((a, b) =>
    tierCount(b, 'critique') - tierCount(a, 'critique') ||
    tierCount(b, 'eleve')    - tierCount(a, 'eleve') ||
    tierCount(b, 'modere')   - tierCount(a, 'modere') ||
    tierCount(b, 'faible')   - tierCount(a, 'faible') ||
    b._count.risques         - a._count.risques
  ).slice(0, 6)

  // Tous les tiers de toutes les analyses, pour le radar global de l'écosystème
  const allTiers = analyses.flatMap(a =>
    a.partiesPrenantes.map(pp => ({
      id: pp.id, nom: pp.nom, nomCourt: pp.nomCourt ?? undefined, type: pp.type, exposition: pp.exposition, fiabilite: pp.fiabilite,
      dependance: pp.dependance, penetration: pp.penetration, maturite: pp.maturite, confiance: pp.confiance,
      critique: pp.critique,
    }))
  )

  const stats = {
    total: analyses.length,
    terminees: analyses.filter(a => a.statut === 'TERMINE').length,
    enCours: analyses.filter(a => a.statut === 'EN_COURS').length,
    soumises: analyses.filter(a => a.statut === 'SOUMIS').length,
    approuvees: analyses.filter(a => a.statut === 'APPROUVE').length,
    risquesCritiques: analyses.reduce((acc, a) =>
      acc + a.risques.filter(r => getRiskTier(r.niveauRisque) === 'critique').length, 0),
    mesuresEnRetard: analyses.reduce((acc, a) =>
      acc + a.mesures.filter(m => m.statut === 'A_FAIRE' && m.priorite === 1).length, 0),
  }

  const analysesAvecCritiques = analyses
    .filter(a => a.risques.some(r => getRiskTier(r.niveauRisque) === 'critique'))
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t.dashboard.greeting}, {session.user.name?.split(' ')[0] || 'Analyste'} 👋
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-gray-500">{t.dashboard.subtitle}</p>
              {userRole === 'RISK_MANAGER' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">{t.roles.RISK_MANAGER}</span>
              )}
              {userRole === 'RSSI' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-medium">{t.roles.RSSI}</span>
              )}
              {userRole === 'ADMIN' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">{t.roles.ADMIN}</span>
              )}
              {userRole === 'LECTEUR' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{t.roles.LECTEUR}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {canCreateAnalyse({ id: userId, role: userRole }) && (
              <>
                <div className="hidden sm:block">
                  <ExpressAnalyseButton variant="button" />
                </div>
                <Link href="/analyses/new" className="btn-primary hidden sm:inline-flex items-center gap-2">
                  + {t.dashboard.newAnalysis}
                </Link>
              </>
            )}
            {userRole === 'ADMIN' && (
              <Link href="/admin/users" className="btn-secondary hidden sm:inline-flex items-center gap-2">
                <KeyRound size={16} aria-hidden="true" /> {t.nav.admin}
              </Link>
            )}
          </div>
        </div>

        {/* Stats KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          {[
            { label: t.dashboard.kpi.total,      value: stats.total,             Icon: ClipboardList, color: 'text-ebios-600',  bg: 'bg-ebios-50',  href: '/analyses' },
            ...(userRole === 'RISK_MANAGER' || userRole === 'RSSI' || userRole === 'ADMIN'
              ? [{ label: t.dashboard.kpi.toApprove,  value: stats.soumises,      Icon: Send,     color: 'text-blue-600',   bg: 'bg-blue-50',   href: '/analyses?filter=soumis' }]
              : [{ label: t.dashboard.kpi.inProgress, value: stats.enCours,       Icon: Settings, color: 'text-orange-600', bg: 'bg-orange-50', href: '/analyses?filter=en_cours' }]
            ),
            { label: t.dashboard.kpi.completed,  value: stats.terminees,         Icon: CheckCircle2,  color: 'text-green-600',  bg: 'bg-green-50',  href: '/analyses?filter=termine' },
            { label: t.dashboard.kpi.critical,   value: stats.risquesCritiques,  Icon: AlertCircle,   color: 'text-red-600',   bg: 'bg-red-50',    href: '/risques?niveau=critique' },
            { label: t.dashboard.kpi.pending,    value: stats.mesuresEnRetard,   Icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50',  href: '/actions?priorite=1' },
          ].map((s, i) => (
            <Link key={i} href={s.href} className={`card p-4 text-center ${s.bg} hover:shadow-md transition-shadow cursor-pointer`}>
              <s.Icon className={`mx-auto mb-1 ${s.color}`} size={24} aria-hidden="true" />
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </Link>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {analyses.length > 0 && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-800">📊 {t.dashboard.overview}</h2>
                  {analyses.length > 6 && (
                    <Link href="/analyses" className="text-sm text-ebios-600 hover:underline">
                      {t.dashboard.viewAll} ({stats.total}) →
                    </Link>
                  )}
                </div>
                <AnalysesChart analyses={overviewAnalyses} />
              </div>
            )}

            {/* Radar global de la menace de l'écosystème — tous les tiers de toutes les analyses */}
            {allTiers.length > 0 && (
              <div className="card p-5">
                <h2 className="font-semibold text-gray-800 mb-1">🌐 {t.dashboard.ecosystemTitle}</h2>
                <p className="text-xs text-gray-500 mb-3">{t.dashboard.ecosystemSubtitle}</p>
                <EcosystemRadar parties={allTiers} showRefs={false} hideHeader aggregated />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-800">{t.dashboard.recent}</h2>
                <Link href="/analyses" className="text-sm text-ebios-600 hover:underline">
                  {t.dashboard.viewAll} ({stats.total}) →
                </Link>
              </div>

              {analyses.length === 0 ? (
                <div className="card p-12 text-center">
                  <div className="text-5xl mb-4">🛡️</div>
                  <h3 className="font-semibold text-gray-800 mb-2">{t.dashboard.noAnalyses}</h3>
                  <p className="text-gray-500 text-sm mb-6">{t.dashboard.noAnalysesDesc}</p>
                  <Link href="/analyses/new" className="btn-primary inline-block">
                    {t.dashboard.createFirst}
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recent.map(a => {
                    const _ai = a.atelierCourant - 1
                    const atelier = { ...ATELIERS_META[_ai], ...((t.ateliersMeta as any)[_ai] ?? {}) }
                    const critiques = a.risques.filter((r: any) => getRiskTier(r.niveauRisque) === 'critique').length
                    const mesuresP1 = a.mesures.filter((m: any) => m.priorite === 1 && m.statut !== 'REALISE').length
                    return (
                      <Link key={a.id} href={`/analyses/${a.id}`}
                        className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow block">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-gray-900 truncate">{a.nom}</span>
                            {(a as any).isSocle && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium flex-shrink-0" title="Analyse socle">🏛️</span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${
                              a.statut === 'TERMINE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {a.statut === 'TERMINE' ? `✅ ${t.dashboard.doneStatus}` : `⚙️ ${t.dashboard.inProgStatus}`}
                            </span>
                            {critiques > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium flex-shrink-0">
                                🔴 {critiques} {critiques === 1 ? t.dashboard.critBadgeSg : t.dashboard.critBadge}
                              </span>
                            )}
                            {mesuresP1 > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex-shrink-0">
                                ⚠️ {mesuresP1} {t.dashboard.p1Badge}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mb-2">
                            {a.organisation && `${a.organisation} · `}
                            {a.secteur && `${a.secteur} · `}
                            {t.dashboard.modified} {formatDate(a.updatedAt, locale)}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                              <div className="bg-ebios-500 h-1.5 rounded-full transition-all"
                                style={{ width: a.statut === 'TERMINE' ? '100%' : `${Math.round(((a.atelierCourant - 1) / 5) * 100)}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              {a.statut === 'TERMINE' ? '✅ 5/5' : `${atelier?.icon} A${a.atelierCourant}/5`}
                            </span>
                            <div className="flex gap-2 text-xs text-gray-500 hidden sm:flex">
                              <span title="Sources">🎭 {a._count.sourcesRisque}</span>
                              <span title="Scénarios">📋 {a._count.scenariosStrategiques}</span>
                              <span title="Risques">⚠️ {a._count.risques}</span>
                              <span title="Mesures">🛡️ {a._count.mesures}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-gray-500">›</div>
                      </Link>
                    )
                  })}
                  <Link href="/analyses/new"
                    className="card p-4 flex items-center justify-center gap-2 text-ebios-600 hover:bg-ebios-50 border-dashed border-2 border-ebios-200 transition-colors">
                    <span className="text-xl">+</span>
                    <span className="font-medium">{t.dashboard.newAnalysis}</span>
                  </Link>
                </div>
              )}
            </div>

            {analysesAvecCritiques.length > 0 && (
              <div className="card p-5">
                <h2 className="font-semibold text-gray-800 mb-3">🔴 {t.dashboard.criticalTitle}</h2>
                <div className="space-y-2">
                  {analysesAvecCritiques.map(a => {
                    const critiques = a.risques.filter((r: any) => getRiskTier(r.niveauRisque) === 'critique')
                    return (
                      <Link key={a.id} href={`/analyses/${a.id}/atelier/5`}
                        className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-red-900">{a.nom}</span>
                          <div className="text-xs text-red-600 mt-0.5">
                            {critiques.length} {critiques.length === 1 ? t.dashboard.criticalScoreSg : t.dashboard.criticalScore}
                          </div>
                        </div>
                        <span className="text-xs text-red-500">{t.dashboard.treat}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Colonne latérale */}
          <div className="space-y-6">
            {analyses.length > 0 && (
              <div className="card p-5">
                <h2 className="font-semibold text-gray-800 mb-3">📈 {t.dashboard.progressTitle}</h2>
                <div className="space-y-2">
                  {ATELIERS_META.map((a, i) => {
                    const done = analyses.filter((x: any) => x.atelierCourant > i + 1 || x.statut === 'TERMINE').length
                    const pct = stats.total > 0 ? Math.round((done / stats.total) * 100) : 0
                    return (
                      <div key={a.num}>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>{a.icon} A{a.num} — {(t.ateliersMeta as any)[i]?.titre ?? a.titre}</span>
                          <span>{done}/{stats.total}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-2 bg-ebios-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="card p-5 space-y-2">
              <h2 className="font-semibold text-gray-800 mb-3">⚡ {t.dashboard.quickTitle}</h2>
              <Link href="/analyses" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-sm text-gray-700">
                📋 {t.dashboard.quickAll}
              </Link>
              {canCreateAnalyse({ id: userId, role: userRole }) && (
                <>
                  <Link href="/analyses/new" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-sm text-gray-700">
                    ➕ {t.dashboard.quickNew}
                  </Link>
                  <ExpressAnalyseButton variant="link" />
                </>
              )}
              {stats.soumises > 0 && (userRole === 'RISK_MANAGER' || userRole === 'RSSI' || userRole === 'ADMIN') && (
                <Link href="/analyses?filter=soumis" className="flex items-center gap-2 p-2 rounded-lg hover:bg-blue-50 text-sm text-blue-700 font-medium">
                  📤 {stats.soumises} {t.dashboard.quickApprove}
                </Link>
              )}
              {userRole !== 'LECTEUR' && (
                <Link href="/configuration" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-sm text-gray-700">
                  ⚙️ {t.dashboard.quickConfig}
                </Link>
              )}
              {userRole === 'ADMIN' && (
                <Link href="/admin/users" className="flex items-center gap-2 p-2 rounded-lg hover:bg-red-50 text-sm text-red-700">
                  🔑 {t.dashboard.quickAdmin}
                </Link>
              )}
            </div>

            <EbiosGuide />
          </div>
        </div>
      </main>
    </div>
  )
}
