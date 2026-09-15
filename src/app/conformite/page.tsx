import { ShieldCheck } from 'lucide-react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Navbar from '@/components/Navbar'
import { getServerT, getServerLocale } from '@/lib/i18n'
import { getAnalyseScope } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { sanitizeConformite, conformiteStats } from '@/lib/conformite'
import { getExigencesFor, listReferentiels } from '@/lib/referentiel.server'
import { rollupConformiteTree, type RollupConfInput } from '@/lib/conformite-rollup'
import ConformiteHeatmap, { type HeatmapRow, type HeatmapRef } from '@/components/ConformiteHeatmap'
import ConformiteGauges from '@/components/ConformiteGauges'
import ConformiteGlobalTrend from '@/components/ConformiteGlobalTrend'
import { globalConformiteTrend } from '@/lib/conformite-trend'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** Dashboard GLOBAL de conformité (Palier 3) : heatmap orgs × référentiels avec
 *  roll-up sur l'arbre d'organisations. Réservé aux rôles de gouvernance. */
export default async function ConformiteGlobalPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as any).id
  const userRole: UserRole = (session.user as any).role ?? 'ANALYSTE'
  if (!(isAdminRole(userRole) || userRole === 'RSSI' || userRole === 'RISK_MANAGER')) redirect('/dashboard')

  const t = await getServerT()
  const locale = await getServerLocale()
  const scope = await getAnalyseScope(userId, userRole)
  const visibleOrgIds = scope.scope.visibleOrgIds ?? []

  // Entités de conformité des organisations visibles (ou toutes en mono-organisation).
  const confs = await prisma.conformite.findMany({
    where: visibleOrgIds.length > 0 ? { organizationId: { in: visibleOrgIds } } : {},
    select: {
      organizationId: true, referentiel: true, entries: true, updatedAt: true,
      organization: { select: { nom: true, path: true } },
      snapshots: { select: { entries: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
    },
  })

  // Nœuds d'organisation (id, path, nom) — dédupliqués.
  const orgMap = new Map<string, { id: string; path: string; nom: string }>()
  for (const c of confs) {
    if (!orgMap.has(c.organizationId)) {
      orgMap.set(c.organizationId, { id: c.organizationId, path: c.organization?.path ?? '/', nom: c.organization?.nom ?? c.organizationId })
    }
  }
  const orgs = [...orgMap.values()]

  // Cellules (stats par org × référentiel) pour le roll-up. Le total est résolu
  // par le résolveur unifié (livré cyber + GRC + custom), comme l'éditeur de socle.
  // Custom = dépend de l'org → cache par (orgId, référentiel). Plusieurs suivis
  // (org-wide + entités) d'un même org×référentiel sont mis en commun par le roll-up.
  const totalByOrgRef = new Map<string, number>()
  const totalFor = async (orgId: string, ref: string) => {
    const key = `${orgId}|${ref}`
    if (!totalByOrgRef.has(key)) totalByOrgRef.set(key, (await getExigencesFor(ref, orgId, locale)).length)
    return totalByOrgRef.get(key)!
  }
  type Cell = RollupConfInput & { deroge: number; couvDerog: number; couvAccept: number; couvPlan: number; partielNet: number }
  const cells: Cell[] = await Promise.all(confs.map(async c => {
    const s = conformiteStats(sanitizeConformite(c.entries), await totalFor(c.organizationId, c.referentiel))
    return {
      organizationId: c.organizationId, referentiel: c.referentiel,
      conforme: s.conforme, partiel: s.partiel, nonConforme: s.nonConforme, na: s.na, deroge: s.deroge,
      couvDerog: s.couvertureDerogation, couvAccept: s.couvertureAcceptation, couvPlan: s.couverturePlanAction,
      partielNet: s.partielNonTraite, total: s.total,
    }
  }))

  const rollup = rollupConformiteTree(orgs.map(o => ({ id: o.id, path: o.path })), cells)

  // Cadrans globaux : conforme + couvertures d'écarts (dérogation / acceptation /
  // plan d'action) agrégées sur tous les suivis. pertinents = conforme + partiel +
  // non conforme + dérogé.
  const g = cells.reduce((a, c) => ({
    conforme: a.conforme + c.conforme, partiel: a.partiel + c.partiel,
    nonConforme: a.nonConforme + c.nonConforme, na: a.na + c.na, deroge: a.deroge + c.deroge,
    couvDerog: a.couvDerog + c.couvDerog, couvAccept: a.couvAccept + c.couvAccept, couvPlan: a.couvPlan + c.couvPlan,
    partielNet: a.partielNet + c.partielNet,
  }), { conforme: 0, partiel: 0, nonConforme: 0, na: 0, deroge: 0, couvDerog: 0, couvAccept: 0, couvPlan: 0, partielNet: 0 })
  const gPert = g.conforme + g.partiel + g.nonConforme + g.deroge

  // Tendance globale (as-of) : timeline de chaque suivi = ses snapshots + son état
  // courant, agrégés par date. pertinents = conforme + partiel + non conforme + dérogé.
  const pointOf = (entries: unknown, date: Date) => {
    const s = conformiteStats(sanitizeConformite(entries), 0)
    return { date, conforme: s.conforme, pertinents: s.conforme + s.partiel + s.nonConforme + s.deroge }
  }
  const trend = globalConformiteTrend(confs.map(cf => ({
    points: [...cf.snapshots.map(sn => pointOf(sn.entries, sn.createdAt)), pointOf(cf.entries, cf.updatedAt)],
  })))

  // Référentiels présents (colonnes), triés par nom — noms résolus via le
  // catalogue unifié (union des orgs visibles), avec repli sur le code.
  const refIds = new Set(confs.map(c => c.referentiel))
  const nomByCode = new Map<string, string>()
  for (const o of orgs) {
    for (const r of await listReferentiels(o.id, locale)) {
      if (refIds.has(r.code)) nomByCode.set(r.code, r.nom)
    }
  }
  const refs: HeatmapRef[] = [...refIds]
    .map(id => ({ id, nom: nomByCode.get(id) ?? id }))
    .sort((a, b) => a.nom.localeCompare(b.nom))

  // Lignes = organisations ayant des données dans leur sous-arbre, ordre arbre (path).
  const depthOf = (p: string) => p.split('/').filter(Boolean).length
  const minDepth = orgs.length ? Math.min(...orgs.map(o => depthOf(o.path))) : 0
  const rows: HeatmapRow[] = orgs
    .filter(o => Object.keys(rollup[o.id] ?? {}).length > 0)
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(o => ({
      orgId: o.id,
      nom: o.nom,
      depth: depthOf(o.path) - minDepth,
      cells: Object.fromEntries(Object.entries(rollup[o.id] ?? {}).map(([ref, c]) => [ref, { taux: c.taux, orgCount: c.orgCount, evalues: c.evalues, total: c.total }])),
    }))

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900"><ShieldCheck size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" /> {t.conformiteGlobal.title}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{t.conformiteGlobal.subtitle}</p>
          </div>
          <a href="/conformite/socle" className="btn-primary text-sm shrink-0">{t.conformiteGlobal.editSocle}</a>
        </div>

        {rows.length > 0 && (
          <div className="card p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">{t.conformiteGlobal.donutTitle}</h2>
            <ConformiteGauges
              conforme={g.conforme} pertinents={gPert}
              couvDerog={g.couvDerog} couvAccept={g.couvAccept} couvPlan={g.couvPlan} partiel={g.partielNet}
              labels={{
                actuelle: t.conformiteGlobal.gaugeActuelle, actuelleHint: t.conformiteGlobal.gaugeActuelleHint,
                avecDerog: t.conformiteGlobal.gaugeDerog, avecDerogHint: t.conformiteGlobal.gaugeDerogHint,
                cible: t.conformiteGlobal.gaugeCible, cibleHint: t.conformiteGlobal.gaugeCibleHint,
                legendConforme: t.conformiteGlobal.legendConforme, legendDeroge: t.conformiteGlobal.legendDeroge,
                legendAccept: t.conformiteGlobal.legendAccept, legendPlan: t.conformiteGlobal.legendPlan,
                legendPartiel: t.conformiteGlobal.legendPartiel2, legendReste: t.conformiteGlobal.legendReste,
              }}
            />
            <ConformiteGlobalTrend points={trend} locale={locale} title={t.conformiteGlobal.trendTitle}
              granLabels={{ month: t.dashboard.conformiteGranMonth, quarter: t.dashboard.conformiteGranQuarter, semester: t.dashboard.conformiteGranSemester, hint: t.dashboard.conformiteGranHint }} />

          </div>
        )}

        <div className="card p-5">
          <ConformiteHeatmap
            rows={rows}
            refs={refs}
            orgCol={t.conformiteGlobal.orgCol}
            emptyLabel={t.conformiteGlobal.emptyNew}
            emptyHref="/conformite/socle"
            emptyCta={t.conformiteGlobal.editSocle}
            viewHrefFor={(_orgId, refId) => `/conformite/socle?ref=${encodeURIComponent(refId)}`}
            cellTitleFor={(c) => t.conformiteGlobal.cellTip.replace('{evalues}', String(c.evalues)).replace('{total}', String(c.total))}
            hrefFor={(orgId, refId) => `/api/organizations/${orgId}/conformite/soa?referentiel=${encodeURIComponent(refId)}`}
            pdfHrefFor={(orgId, refId) => `/api/organizations/${orgId}/conformite/soa?referentiel=${encodeURIComponent(refId)}&format=pdf`}
            pptxHrefFor={(orgId, refId) => `/api/organizations/${orgId}/conformite/soa?referentiel=${encodeURIComponent(refId)}&format=pptx`}
          />
          {rows.length > 0 && (
            <p className="text-xs text-gray-400 mt-3">{t.conformiteGlobal.legend}</p>
          )}
        </div>
      </main>
    </div>
  )
}
