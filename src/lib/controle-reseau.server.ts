// Chargement de la consolidation des contrôles de référence (organisation active → entités descendantes visibles).
// Partagé par GET /api/controles/reseau et son export Excel. Spec P3.
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutDefinir, type UserRole } from '@/lib/permissions'
import { consolider } from '@/lib/controle-reseau'

export async function chargerReseau(userId: string, instanceRole: UserRole) {
  const scope = await getAnalyseScope(userId, instanceRole)
  const orgId = scope.activeOrgId
  if (!orgId) return null
  const cfg = await getOrgConfig(orgId)
  if (!cfg.controlePermanentActive) return null

  const mere = await prisma.organization.findUnique({ where: { id: orgId }, select: { path: true, nom: true } })
  const visibles = scope.scope.isSuperAdmin ? null : scope.scope.visibleOrgIds
  const orgs = mere?.path && mere.path !== '/'
    ? await prisma.organization.findMany({ where: { path: { startsWith: mere.path }, actif: true }, select: { id: true, nom: true, path: true }, orderBy: { path: 'asc' } })
    : []
  const entites = orgs.filter(o => o.path !== mere!.path && (!visibles || visibles.includes(o.id))).map(o => ({ id: o.id, nom: o.nom }))

  const references = await prisma.controle.findMany({ where: { organizationId: orgId, estReference: true }, orderBy: { intitule: 'asc' } })
  const declinaisons = references.length
    ? await prisma.controle.findMany({
      where: { referenceId: { in: references.map(r => r.id) }, ...(visibles ? { organizationId: { in: visibles } } : {}) },
      select: { id: true, organizationId: true, actif: true, periodicite: true, createdAt: true, referenceId: true, executions: { select: { resultat: true, dateRealisation: true } } },
    })
    : []
  const candidats = await prisma.controle.findMany({ where: { organizationId: orgId, estReference: false, referenceId: null, actif: true }, select: { id: true, intitule: true }, orderBy: { intitule: 'asc' } })

  const now = new Date()
  return {
    organisation: mere?.nom ?? '',
    peutDecliner: peutDefinir(scope.role, { secondeLigneActive: cfg.secondeLigneActive }),
    entites,
    candidats,
    references: references.map(r => ({
      id: r.id, intitule: r.intitule, periodicite: r.periodicite, cle: r.cle,
      ...consolider(declinaisons.filter(d => d.referenceId === r.id), now),
    })),
  }
}
