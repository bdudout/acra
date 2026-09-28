import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { ShieldCheck } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { prisma } from '@/lib/prisma'
import { getServerT } from '@/lib/i18n'
import { type UserRole } from '@/lib/permissions'
import { OPERATIONAL_PROFILE_CATALOGS, sanitizeOperationalProfileEntries, type OperationalProfileFramework } from '@/lib/operational-profiles'
import Navbar from '@/components/Navbar'
import OperationalProfilesEditor from '@/components/OperationalProfilesEditor'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const PREFIX = 'OP_PROFILE:'

export default async function OperationalProfilesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const role = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, role)
  const config = await getOrgConfig(scope.activeOrgId)
  if (!config.profilsOperationnelsActive || !scope.activeOrgId) redirect('/dashboard')
  const t = await getServerT()
  const rows = await prisma.conformite.findMany({
    where: { organizationId: scope.activeOrgId, referentiel: { startsWith: PREFIX }, entite: '' },
    select: { referentiel: true, entries: true, updatedAt: true },
  })
  const entriesByFramework = new Map(rows.map(row => [row.referentiel.slice(PREFIX.length) as OperationalProfileFramework, row]))
  const canManage = scope.role === 'ADMIN' || scope.role === 'SUPER_ADMIN' || scope.role === 'RSSI' || scope.role === 'RISK_MANAGER' || scope.role === 'CONFORMITE'
  const profiles = (Object.keys(OPERATIONAL_PROFILE_CATALOGS) as OperationalProfileFramework[]).map(framework => ({
    framework, catalog: OPERATIONAL_PROFILE_CATALOGS[framework], entries: sanitizeOperationalProfileEntries(framework, entriesByFramework.get(framework)?.entries),
  }))
  return <div className="min-h-screen bg-gray-50 dark:bg-gray-900"><Navbar /><main id="main-content" className="max-w-5xl mx-auto px-4 py-8">
    <header className="mb-7"><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100"><ShieldCheck size={24} className="inline align-[-0.16em] mr-2 text-ebios-600" />{t.operationalProfiles.title}</h1><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.operationalProfiles.subtitle}</p></header>
    <OperationalProfilesEditor profiles={profiles} canManage={canManage} labels={t.operationalProfiles} />
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-5">{t.operationalProfiles.manageHint}</p>
  </main></div>
}
