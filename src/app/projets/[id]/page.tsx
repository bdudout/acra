import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { analyseAccessWhere, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { getOrgConfig, optionsStructure } from '@/lib/org-config.server'
import { getEffectiveScaleConfig } from '@/lib/configuration-server'
import { canCreateAnalyse, canEditAnalyse, resolveAnalyseRole, type UserRole } from '@/lib/permissions'
import { syntheseProjet } from '@/lib/projet-synthese'
import { indicateursProjet } from '@/lib/projet-indicateurs'
import { cotations } from '@/lib/cotation-risque'
import { normalizePatterns, PATTERNS_MAX_MAX } from '@/lib/patterns-archi'
import Navbar from '@/components/Navbar'
import ProjetPresentation from '@/components/projet360/ProjetPresentation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// /projets/[id] — présentation d'un projet 360 (lecture) ; « Modifier » ouvre les phases du projet.
export default async function ProjetPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const { id } = await params

  const analyse = await prisma.analyse.findFirst({
    where: await analyseAccessWhere(userId, instanceRole, id),
    select: {
      id: true, nom: true, statut: true, secteur: true, patternsArchi: true, methode: true, deletedAt: true, userId: true, organizationId: true,
      accesUtilisateurs: true,
      cadrage: { select: { perimetre: true, objectifsEtude: true } },
      analysesDuProjet: { where: { deletedAt: null }, select: { id: true, nom: true }, orderBy: { createdAt: 'desc' }, take: 20 },
      risques: { select: { id: true, nom: true, gravite: true, vraisemblance: true, niveauRisque: true, graviteActuelle: true, vraisemblanceActuelle: true, niveauActuel: true, graviteResiduelle: true, vraisemblanceResiduelle: true, taxonomieCode: true, domaine: true } },
    },
  })
  if (!analyse || analyse.deletedAt || analyse.methode !== 'PROJET_360') notFound()
  const orgConfig = await getOrgConfig(analyse.organizationId)
  if (!orgConfig.projets360Active) notFound()

  const scale = await getEffectiveScaleConfig(analyse.organizationId)
  const ctx = { scale, appetit: orgConfig.appetitRisque }
  const synthese = syntheseProjet(analyse.risques, ctx)
  const now = new Date()
  // Tous les plans rattachés aux risques du projet (terminés compris : avancement), avec le risque couvert.
  const plans = analyse.organizationId ? await prisma.planAction.findMany({
    where: { organizationId: analyse.organizationId, liens: { some: { type: 'RISQUE_ANALYSE', ref: analyse.id } } },
    select: { statut: true, echeance: true, porteur: true, liens: { where: { type: 'RISQUE_ANALYSE', ref: analyse.id }, select: { targetId: true } } },
  }) : []
  const indicateurs = indicateursProjet({ risques: analyse.risques, ctx, now, plans: plans.map(pl => ({ statut: pl.statut, echeance: pl.echeance, porteur: pl.porteur, risqueIds: pl.liens.map(x => x.targetId) })) })
  const matrice = analyse.risques.map(r => ({ id: r.id, nom: r.nom, domaine: r.domaine, ...cotations(r) }))

  const role = resolveAnalyseRole(instanceRole, analyse.organizationId, analyse.organizationId ? await getEffectiveRoleForOrg(userId, instanceRole, analyse.organizationId) : null)
  const canEdit = canEditAnalyse({ id: userId, role }, { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs })
  const canCreateCyber = !!analyse.organizationId && canCreateAnalyse({ id: userId, role }, await optionsStructure(analyse.organizationId))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        <ProjetPresentation canEdit={canEdit} canCreateCyber={canCreateCyber} projet={{
          id: analyse.id, nom: analyse.nom, statut: analyse.statut, secteur: analyse.secteur,
          patterns: normalizePatterns(analyse.patternsArchi, { max: PATTERNS_MAX_MAX }),
          perimetre: analyse.cadrage?.perimetre ?? null, objectifs: analyse.cadrage?.objectifsEtude ?? null,
          analyses: analyse.analysesDuProjet,
          synthese: { ...synthese, principaux: synthese.principaux.map(r => ({ ...r, palier: { label: r.palier.label, couleur: r.palier.couleur } })) },
          matrice, scale, indicateurs,
        }} />
      </main>
    </div>
  )
}
