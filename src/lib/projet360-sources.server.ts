// ─── Analyses cyber utilisables comme source d'un projet 360 (serveur) ───────
// Filtre unique (import de risques / tiers, import des données et services) : analyse cyber accessible à l'utilisateur,
// de la MÊME organisation que le projet, non supprimée, autre que le projet. Une appartenance directe moins privilégiée
// dans l'organisation du projet prime sur le rôle de session ; sans appartenance, seules les analyses explicitement
// possédées / partagées restent visibles.
import { prisma } from '@/lib/prisma'
import { analyseWhereClause, type UserRole } from '@/lib/permissions'
import { analyseAccessWhere, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { RISK_METHODS, METHOD_META } from '@/lib/methodes'

export const CYBER_METHODS = RISK_METHODS.filter(m => METHOD_META[m].cyber)

export async function sourcesCyberWhere(userId: string, role: UserRole, projet: { id: string; organizationId: string }) {
  const targetRole = await getEffectiveRoleForOrg(userId, role, projet.organizationId)
  return {
    AND: [analyseWhereClause(userId, targetRole ?? 'LECTEUR', { visibleOrgIds: [projet.organizationId], isSuperAdmin: false })],
    organizationId: projet.organizationId,
    methode: { in: CYBER_METHODS as string[] },
    deletedAt: null,
    NOT: { id: projet.id },
  }
}

/** Analyses cyber rattachées au projet (Analyse.projetSourceId) que l'utilisateur peut ouvrir — bascule de vue, présentation. */
export async function analysesCyberDuProjet(userId: string, role: UserRole, projet: { id: string; organizationId: string | null }, take = 20) {
  if (!projet.organizationId) return []
  return prisma.analyse.findMany({
    where: { ...(await sourcesCyberWhere(userId, role, { id: projet.id, organizationId: projet.organizationId })), projetSourceId: projet.id },
    select: { id: true, nom: true }, orderBy: { createdAt: 'desc' }, take,
  })
}

/**
 * Projet 360 de rattachement d'une analyse (Analyse.projetSourceId), seulement s'il reste accessible à l'utilisateur
 * (bascule de vue analyse ⇄ projet). `qualification` : réponses 360 en plus (qualification de l'analyse reprise).
 */
export async function projetLieAccessible(userId: string, role: UserRole, projetSourceId: string | null | undefined): Promise<{ id: string; nom: string } | null>
export async function projetLieAccessible(userId: string, role: UserRole, projetSourceId: string | null | undefined, opts: { qualification: true }): Promise<{ id: string; nom: string; qualification: unknown } | null>
export async function projetLieAccessible(userId: string, role: UserRole, projetSourceId: string | null | undefined, opts?: { qualification: true }) {
  if (!projetSourceId) return null
  return prisma.analyse.findFirst({
    where: { ...(await analyseAccessWhere(userId, role, projetSourceId)), methode: 'PROJET_360', deletedAt: null },
    select: { id: true, nom: true, ...(opts?.qualification ? { qualification: true } : {}) },
  })
}
