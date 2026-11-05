import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { getAnalyseScope, roleSurRessource } from '@/lib/org-context.server'
import { peutTrancher } from '@/lib/double-validation.server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/validations — demandes de double validation des organisations VISIBLES (EN_ATTENTE par défaut ;
 * `?statut=toutes` = les 100 dernières). Chaque demande indique si l'utilisateur peut la trancher ou l'annuler.
 */
export const GET = withAccess({ org: 'none' }, async (req, { user }) => {
  const scope = await getAnalyseScope(user.id, user.role)
  const orgIds = scope.scope.isSuperAdmin && scope.scope.visibleOrgIds.length === 0 ? null : scope.scope.visibleOrgIds
  const toutes = req.nextUrl.searchParams.get('statut') === 'toutes'
  const demandes = await prisma.demandeValidation.findMany({
    where: { ...(orgIds ? { organizationId: { in: orgIds } } : {}), ...(toutes ? {} : { statut: 'EN_ATTENTE' }) },
    orderBy: { createdAt: 'desc' }, take: 100,
  })
  const ids = [...new Set(demandes.flatMap(d => [d.demandeurId, d.valideurId].filter((x): x is string => !!x)))]
  const noms = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })).map(u => [u.id, u.name || u.email]))
  const roles = new Map<string, Awaited<ReturnType<typeof roleSurRessource>>>()
  const lignes = await Promise.all(demandes.map(async d => {
    if (!roles.has(d.organizationId)) roles.set(d.organizationId, await roleSurRessource(user.id, user.role, d.organizationId))
    const estDemandeur = d.demandeurId === user.id
    const peutDecider = d.statut === 'EN_ATTENTE' && !estDemandeur && await peutTrancher(d, roles.get(d.organizationId)!, user.id)
    return {
      id: d.id, type: d.type, libelle: d.libelle, statut: d.statut, createdAt: d.createdAt, decideLe: d.decideLe, motifDecision: d.motifDecision,
      commentaire: typeof (d.payload as Record<string, unknown>)?.commentaire === 'string' ? (d.payload as Record<string, string>).commentaire : null,
      demandeur: noms.get(d.demandeurId) ?? null, valideur: d.valideurId ? noms.get(d.valideurId) ?? null : null,
      peutDecider, peutAnnuler: d.statut === 'EN_ATTENTE' && estDemandeur,
    }
  }))
  return NextResponse.json({ demandes: lignes, enAttente: lignes.filter(l => l.peutDecider).length })
})
