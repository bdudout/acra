import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import Navbar from '@/components/Navbar'
import { getServerT, getServerLocale } from '@/lib/i18n'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { isOrgLevelConformite } from '@/lib/conformite-config'
import { referentielsDesactivesForOrg } from '@/lib/referentiel.server'
import { FRAMEWORK_IDS, FRAMEWORK_META, type FrameworkId } from '@/lib/frameworks-data'
import OrgConformiteEditor from '@/components/OrgConformiteEditor'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Éditeur du socle de conformité au niveau organisation (ADMIN / RSSI / Risk Manager).
export default async function ConformiteSoclePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  if (!(isAdminRole(instanceRole) || instanceRole === 'RSSI' || instanceRole === 'RISK_MANAGER')) redirect('/conformite')

  const scope = await getAnalyseScope(userId, instanceRole)
  const orgId = scope.activeOrgId
  if (!orgId) redirect('/dashboard')
  const cfg = await getOrgConfig(orgId)
  const t = await getServerT()
  const locale = await getServerLocale()

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { nom: true } })

  // Référentiels cyber livrés (FRAMEWORK_META), hors CUSTOM et hors désactivés pour l'org.
  const desactives = await referentielsDesactivesForOrg(orgId)
  const referentiels = (FRAMEWORK_IDS as readonly string[])
    .filter(code => code !== 'CUSTOM' && !desactives.has(code))
    .map(code => ({ code, nom: FRAMEWORK_META[code as FrameworkId]?.nom ?? code }))

  const applicable = cfg.conformiteActive && isOrgLevelConformite(cfg.conformiteNiveau)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        <Link href="/conformite" className="text-sm text-ebios-600 hover:underline">← {t.conformiteGlobal.title}</Link>
        <div className="mt-3">
          {!applicable ? (
            <div className="card p-6">
              <p className="text-gray-700 text-sm">{t.conformiteSocle.nonApplicable}</p>
              <Link href="/configuration#conformite-config" className="inline-block mt-3 text-sm font-medium text-ebios-600 hover:underline">
                {t.conformiteGlobal.emptyCta} →
              </Link>
            </div>
          ) : referentiels.length === 0 ? (
            <div className="card p-6"><p className="text-gray-500 text-sm">{t.conformiteSocle.aucunReferentiel}</p></div>
          ) : (
            <OrgConformiteEditor
              orgId={orgId}
              orgNom={org?.nom ?? '—'}
              referentiels={referentiels}
              initialRef={referentiels.some(r => r.code === 'ISO27001') ? 'ISO27001' : referentiels[0].code}
            />
          )}
        </div>
      </main>
    </div>
  )
}
