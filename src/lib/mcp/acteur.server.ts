// ─── Rôle porté par une clé MCP ──────────────────────────────────────────────
// Une clé d'API n'a pas de rôle propre : elle agit pour le compte de son CRÉATEUR, avec son rôle EFFECTIF dans
// l'organisation de la clé (getEffectiveRoleForOrg, A01/CWE-863). Les outils de lecture appliquent donc le même RBAC
// que les écrans. Clé sans créateur, créateur désactivé ou qui n'est plus membre : aucun acteur (lecture refusée).
import { prisma } from '@/lib/prisma'
import { getEffectiveRoleForOrg } from '@/lib/org-context.server'
import type { UserRole } from '@/lib/permissions'
import type { McpContext } from './tools.server'

export interface ActeurMcp { userId: string; role: UserRole }

export async function acteurMcp(ctx: McpContext): Promise<ActeurMcp | null> {
  const key = await prisma.apiKey.findFirst({ where: { id: ctx.keyId, organizationId: ctx.organizationId }, select: { createdBy: true } })
  if (!key?.createdBy) return null
  const user = await prisma.user.findUnique({ where: { id: key.createdBy }, select: { id: true, role: true, isActive: true } })
  if (!user || user.isActive === false) return null
  const role = await getEffectiveRoleForOrg(user.id, user.role as UserRole, ctx.organizationId)
  return role ? { userId: user.id, role } : null
}
