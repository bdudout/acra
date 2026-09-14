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
import { usesConformiteEntity, isEntiteLevelConformite } from '@/lib/conformite-config'
import { listReferentiels } from '@/lib/referentiel.server'
import OrgConformiteEditor from '@/components/OrgConformiteEditor'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Éditeur du socle de conformité au niveau organisation (ADMIN / RSSI / Risk Manager).
export default async function ConformiteSoclePage({ searchParams }: {
  searchParams: Promise<{ ref?: string }>
}) {
  const { ref: refParam } = await searchParams
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

  // Référentiels ÉVALUABLES : tous les référentiels ACTIFS de l'org (livrés cyber +
  // GRC + personnalisés), hors le placeholder CUSTOM. Un référentiel personnalisé
  // doit d'abord être créé dans « Référentiels & exigences ».
  const all = await listReferentiels(orgId, locale)
  const referentiels = all
    .filter(r => r.actif && r.code !== 'CUSTOM')
    .map(r => ({ code: r.code, nom: r.nom }))

  const applicable = cfg.conformiteActive && usesConformiteEntity(cfg.conformiteNiveau)
  const multiSuivi = isEntiteLevelConformite(cfg.conformiteNiveau)

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
            <>
              {isAdminRole(instanceRole) && (
                <div className="card p-4 mb-4 border-l-4 border-l-ebios-300 bg-ebios-50/40">
                  <p className="text-sm text-gray-700">{t.conformiteSocle.customNote}</p>
                  <Link href="/referentiels" className="inline-block mt-1.5 text-sm font-medium text-ebios-600 hover:underline">
                    {t.conformiteSocle.customNoteLink} →
                  </Link>
                </div>
              )}
              <OrgConformiteEditor
                orgId={orgId}
                orgNom={org?.nom ?? '—'}
                referentiels={referentiels}
                initialRef={
                  refParam && referentiels.some(r => r.code === refParam) ? refParam
                  : referentiels.some(r => r.code === 'ISO27001') ? 'ISO27001'
                  : referentiels[0].code
                }
                multiSuivi={multiSuivi}
              />
            </>
          )}
        </div>
      </main>
    </div>
  )
}
