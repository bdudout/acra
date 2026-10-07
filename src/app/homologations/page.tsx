import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Navbar from '@/components/Navbar'
import { analyseWhereClause, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { getServerT } from '@/lib/i18n'
import HomologationsManager, { type HomologationRow } from '@/components/HomologationsManager'
import { etatValidite, sanitizePieces, sanitizeReserves } from '@/lib/homologation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// /homologations — registre des homologations de sécurité (module optionnel, spec P2).
export default async function HomologationsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')

  const t = await getServerT()
  const userId = (session.user as { id: string }).id
  const instanceRole: UserRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  const config = scope.activeOrgId ? await getOrgConfig(scope.activeOrgId) : null

  if (!config?.homologationsActive) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8"><p className="text-gray-600 dark:text-gray-400">{t.homologation.inactive}</p></main>
      </div>
    )
  }

  const orgWhere = scope.scope.isSuperAdmin ? {} : { organizationId: { in: scope.scope.visibleOrgIds } }
  const [rows, analyses, membres] = await Promise.all([
    prisma.homologation.findMany({ where: orgWhere, include: { analyse: { select: { nom: true } } }, orderBy: { updatedAt: 'desc' } }),
    prisma.analyse.findMany({
      where: { AND: [analyseWhereClause(userId, scope.role, scope.scope), { organizationId: scope.activeOrgId!, deletedAt: null }] },
      select: { id: true, nom: true }, orderBy: { nom: 'asc' },
    }),
    prisma.orgMembership.findMany({ where: { organizationId: scope.activeOrgId! }, select: { user: { select: { id: true, name: true, email: true } } } }),
  ])
  const now = new Date()
  const initial: HomologationRow[] = rows.map(h => ({
    id: h.id, systeme: h.systeme, perimetre: h.perimetre, statut: h.statut, etat: etatValidite(h, now),
    analyseId: h.analyseId, analyseNom: h.analyse?.nom ?? null, preparePar: h.preparePar, autoriteId: h.autoriteId,
    dureeMois: h.dureeMois, pieces: sanitizePieces(h.pieces), reserves: sanitizeReserves(h.reserves),
    dateDecision: h.dateDecision?.toISOString() ?? null, dateFin: h.dateFin?.toISOString() ?? null, commentaireDecision: h.commentaireDecision,
  }))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <HomologationsManager initial={initial} analyses={analyses} userId={userId} role={scope.role}
          membres={membres.map(m => ({ id: m.user.id, nom: m.user.name || m.user.email }))} />
      </main>
    </div>
  )
}
