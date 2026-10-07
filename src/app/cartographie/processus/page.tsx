import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { getServerT } from '@/lib/i18n'
import { ETAPES_CARTO, resolveProcessusCarto, prochaineRevue, statutRevue } from '@/lib/processus-carto'
import Navbar from '@/components/Navbar'
import ProcessusCartoView from '@/components/ProcessusCartoView'
import { superAdminSansOrganisation } from '@/lib/choisir-organisation'
import ChoisirOrganisation from '@/components/ChoisirOrganisation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Processus de cartographie des risques : explication éditable par la gouvernance et
// statut de revue (dernière mise à jour du registre + périodicité). Registre requis.
export default async function ProcessusCartoPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  // Super-administrateur en vue « toutes les organisations » : page propre à une organisation → message d'information.
  if (superAdminSansOrganisation(instanceRole, scope.activeOrgId)) return <ChoisirOrganisation />
  if (!scope.activeOrgId) notFound()
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.registreRisquesActive) notFound()
  const t = await getServerT()
  const etapes = t.processusCarto.etapes as Record<string, { titre: string; description: string }>
  const processus = resolveProcessusCarto(cfg.processusCartographie, ETAPES_CARTO.map(key => ({ key, ...etapes[key] })))
  const agg = await prisma.riskItem.aggregate({ where: { organizationId: scope.activeOrgId }, _max: { updatedAt: true }, _count: true })
  const derniere = agg._max.updatedAt ?? null
  const faits = {
    derniereMaj: derniere?.toISOString() ?? null,
    prochaineRevue: derniere ? prochaineRevue(derniere, processus.periodicite).toISOString() : null,
    statut: statutRevue(derniere, processus.periodicite, new Date()),
    nbRisques: agg._count,
  }
  const canEdit = isAdminRole(scope.role) || scope.role === 'RSSI' || scope.role === 'RISK_MANAGER'
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main id="main-content" className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/cartographie" className="text-sm text-ebios-600 hover:underline">← {t.processusCarto.backToCarto}</Link>
        <header className="mt-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t.processusCarto.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.processusCarto.subtitle}</p>
        </header>
        <ProcessusCartoView processus={processus} faits={faits} canEdit={canEdit} />
      </main>
    </div>
  )
}
