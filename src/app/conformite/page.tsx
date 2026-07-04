import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Navbar from '@/components/Navbar'
import { getServerT, getServerLocale } from '@/lib/i18n'
import { getAnalyseScope } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { sanitizeConformite, conformiteStats } from '@/lib/conformite'
import { getFrameworkControles, FRAMEWORK_META, type FrameworkId } from '@/lib/frameworks-data'
import { rollupConformiteTree, type RollupConfInput } from '@/lib/conformite-rollup'
import ConformiteHeatmap, { type HeatmapRow, type HeatmapRef } from '@/components/ConformiteHeatmap'

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
    select: { organizationId: true, referentiel: true, entries: true, organization: { select: { nom: true, path: true } } },
  })

  // Nœuds d'organisation (id, path, nom) — dédupliqués.
  const orgMap = new Map<string, { id: string; path: string; nom: string }>()
  for (const c of confs) {
    if (!orgMap.has(c.organizationId)) {
      orgMap.set(c.organizationId, { id: c.organizationId, path: c.organization?.path ?? '/', nom: c.organization?.nom ?? c.organizationId })
    }
  }
  const orgs = [...orgMap.values()]

  // Cellules (stats par org × référentiel) pour le roll-up.
  const totalByRef = new Map<string, number>()
  const totalFor = (ref: string) => {
    if (!totalByRef.has(ref)) totalByRef.set(ref, getFrameworkControles(ref as FrameworkId, undefined, locale).length)
    return totalByRef.get(ref)!
  }
  const cells: RollupConfInput[] = confs.map(c => {
    const s = conformiteStats(sanitizeConformite(c.entries), totalFor(c.referentiel))
    return { organizationId: c.organizationId, referentiel: c.referentiel, conforme: s.conforme, partiel: s.partiel, nonConforme: s.nonConforme, na: s.na, total: s.total }
  })

  const rollup = rollupConformiteTree(orgs.map(o => ({ id: o.id, path: o.path })), cells)

  // Référentiels présents (colonnes), triés par nom.
  const refIds = [...new Set(confs.map(c => c.referentiel))]
  const refs: HeatmapRef[] = refIds
    .map(id => ({ id, nom: FRAMEWORK_META[id as FrameworkId]?.nom ?? id }))
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">🛡️ {t.conformiteGlobal.title}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t.conformiteGlobal.subtitle}</p>
        </div>

        <div className="card p-5">
          <ConformiteHeatmap
            rows={rows}
            refs={refs}
            orgCol={t.conformiteGlobal.orgCol}
            emptyLabel={t.conformiteGlobal.empty}
            hrefFor={(orgId, refId) => `/api/organizations/${orgId}/conformite/soa?referentiel=${encodeURIComponent(refId)}`}
          />
          {rows.length > 0 && (
            <p className="text-xs text-gray-400 mt-3">{t.conformiteGlobal.legend}</p>
          )}
        </div>
      </main>
    </div>
  )
}
