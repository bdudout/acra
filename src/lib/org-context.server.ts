/**
 * org-context.server.ts — Résolution SERVEUR du contexte d'organisation
 * (multi-organisation). S'appuie sur la logique pure de `org-context.ts`.
 *
 * Côté serveur uniquement : lit les appartenances en base, l'organisation active
 * (cookie `acra_org`), et produit le `OrgScopeContext` consommé par
 * `analyseWhereClause(userId, role, ctx)`.
 *
 * Rétrocompatible : si l'utilisateur n'a qu'une appartenance (instance mono-org),
 * le contexte couvre simplement son organisation racine.
 */

import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import type { UserRole, OrgScopeContext } from '@/lib/permissions'
import {
  resolveActiveMembership,
  visibleOrgIds,
  type Membership,
  type OrgNode,
} from '@/lib/org-context'

export const ACTIVE_ORG_COOKIE = 'acra_org'

export interface ResolvedOrgContext {
  /** Appartenances de l'utilisateur (organisation + rôle + portée). */
  memberships: (Membership & { nom: string })[]
  /** Organisation active retenue (ou null si aucune appartenance). */
  activeOrgId: string | null
  /** Rôle EFFECTIF dans l'organisation active (rôle d'appartenance). */
  role: UserRole | null
  /** Organisations visibles (nœud actif + descendants si portée SUBTREE). */
  visibleOrgIds: string[]
  /** Niveau instance : voit toutes les organisations. */
  isSuperAdmin: boolean
}

/**
 * Résout le contexte d'organisation d'un utilisateur. `instanceRole` est le rôle
 * porté par la session (User.role) — sert à détecter le SUPER_ADMIN.
 * `requestedOrgId` force une organisation active (sinon : cookie puis principale).
 */
export async function resolveOrgContext(
  userId: string,
  instanceRole: UserRole,
  requestedOrgId?: string | null,
): Promise<ResolvedOrgContext> {
  const isSuperAdmin = instanceRole === 'SUPER_ADMIN'

  const [memberRows, allOrgs] = await Promise.all([
    prisma.orgMembership.findMany({
      where: { userId },
      select: { organizationId: true, role: true, scope: true, organization: { select: { nom: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.organization.findMany({ select: { id: true, path: true, parentId: true } }),
  ])

  const memberships: (Membership & { nom: string })[] = memberRows.map(m => ({
    organizationId: m.organizationId,
    role: m.role as UserRole,
    scope: m.scope as Membership['scope'],
    nom: m.organization?.nom ?? '',
  }))

  const orgs: OrgNode[] = allOrgs.map(o => ({ id: o.id, path: o.path, parentId: o.parentId }))

  // Organisation active : cookie si non précisée explicitement.
  const cookieStore = await cookies()
  const cookieOrg = requestedOrgId ?? cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null

  // SUPER_ADMIN : voit toutes les organisations (pas de restriction).
  if (isSuperAdmin) {
    const active = cookieOrg && orgs.some(o => o.id === cookieOrg) ? cookieOrg : (orgs[0]?.id ?? null)
    return {
      memberships,
      activeOrgId: active,
      role: 'SUPER_ADMIN',
      visibleOrgIds: orgs.map(o => o.id),
      isSuperAdmin: true,
    }
  }

  const active = resolveActiveMembership(memberships, cookieOrg)
  if (!active) {
    // Aucune appartenance : ne voit rien (sécurité).
    return { memberships, activeOrgId: null, role: null, visibleOrgIds: [], isSuperAdmin: false }
  }

  return {
    memberships,
    activeOrgId: active.organizationId,
    role: active.role,
    visibleOrgIds: visibleOrgIds(active, orgs),
    isSuperAdmin: false,
  }
}

/**
 * Raccourci pour les vues : rôle EFFECTIF (dans l'org active) + portée prête pour
 * `analyseWhereClause(userId, role, scope)`, et organisation active (pour créer).
 */
export async function getAnalyseScope(userId: string, instanceRole: UserRole): Promise<{
  role: UserRole
  activeOrgId: string | null
  scope: OrgScopeContext
  memberships: (Membership & { nom: string })[]
}> {
  const ctx = await resolveOrgContext(userId, instanceRole)
  return {
    role: (ctx.role ?? instanceRole),
    activeOrgId: ctx.activeOrgId,
    scope: { visibleOrgIds: ctx.visibleOrgIds, isSuperAdmin: ctx.isSuperAdmin },
    memberships: ctx.memberships,
  }
}
