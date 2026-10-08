// ─── Registre des traitements : identité du responsable — accès serveur ───────
// Lit la saisie de l'organisation et les DPO désignés dans ACRA (rôle DPO de l'organisation, ou d'un ancêtre avec
// portée sous-arbre) ; calcule l'identité effective (lib/ropa-identite). Utilisé par l'API et l'export du registre.
import { prisma } from './prisma'
import { dposDesignes, identiteEffective, sanitizeIdentite } from './ropa-identite'

/** Identité effective : DPO désigné dans l'organisation ou dans un ancêtre (portée sous-arbre), sinon saisie libre. */
export async function lireIdentite(orgId: string) {
  const [org, ligne] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, path: true } }),
    prisma.ropaIdentite.findUnique({ where: { organizationId: orgId } }),
  ])
  const chaine = (org?.path ?? `/${orgId}/`).split('/').filter(Boolean)
  const rattachements = await prisma.orgMembership.findMany({
    where: { role: 'DPO', organizationId: { in: chaine } },
    select: { organizationId: true, role: true, scope: true, user: { select: { name: true, email: true, isActive: true } } },
  })
  const saisie = sanitizeIdentite(ligne ?? {})
  const designes = dposDesignes(org ?? { id: orgId, path: `/${orgId}/` }, rattachements)
  return { saisie, designes, effective: identiteEffective(saisie, designes) }
}

