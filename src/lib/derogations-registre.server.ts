// ─── Registre des dérogations : lignes visibles (page /derogations et GET /api/derogations?page=…) ──
// Dérogations de toutes les analyses accessibles (analyseWhereClause) OU autonomes d'une organisation visible.
import { prisma } from '@/lib/prisma'
import { analyseWhereClause, type OrgScopeContext, type UserRole } from '@/lib/permissions'
import type { RegistreRow } from '@/lib/derogations-registre'

export async function chargerRegistreDerogations(userId: string, role: UserRole, scope: OrgScopeContext): Promise<RegistreRow[]> {
  const analyses = await prisma.analyse.findMany({
    where: analyseWhereClause(userId, role, scope),
    select: { id: true, nom: true },
  })
  const byId = new Map(analyses.map(a => [a.id, a.nom]))
  const orgLevel = scope.isSuperAdmin
    ? { analyseId: null }
    : { analyseId: null, organizationId: { in: scope.visibleOrgIds } }
  const derogations = await prisma.derogation.findMany({
    where: { OR: [{ analyseId: { in: analyses.map(a => a.id) } }, orgLevel] },
    orderBy: [{ statut: 'asc' }, { dateFin: 'asc' }, { createdAt: 'desc' }],
    select: { id: true, analyseId: true, portee: true, referentiel: true, ref: true, intitule: true, statut: true, dateFin: true },
  })
  return derogations.map(d => ({
    id: d.id,
    analyseId: d.analyseId,
    analyseNom: d.analyseId ? (byId.get(d.analyseId) ?? '—') : null,
    portee: d.portee,
    referentiel: d.referentiel,
    ref: d.ref,
    intitule: d.intitule,
    statut: d.statut,
    dateFin: d.dateFin ? d.dateFin.toISOString() : null,
  }))
}
