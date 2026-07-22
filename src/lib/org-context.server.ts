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
  visibleOrgIds,
  subtreeIds,
  isInSubtree,
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

  // SUPER_ADMIN : « toutes les organisations » par défaut, ou FOCALISE une org (drill-down)
  // si le cookie pointe vers une organisation valide → périmètre = sous-arbre de cette org.
  if (isSuperAdmin) {
    const active = cookieOrg && orgs.some(o => o.id === cookieOrg) ? cookieOrg : null
    const node = active ? orgs.find(o => o.id === active) : null
    return {
      memberships,
      activeOrgId: active,
      role: 'SUPER_ADMIN',
      visibleOrgIds: node ? subtreeIds(orgs, node.path) : orgs.map(o => o.id),
      isSuperAdmin: true,
    }
  }

  if (memberships.length === 0) {
    // Aucune appartenance : ne voit rien (sécurité).
    return { memberships, activeOrgId: null, role: null, visibleOrgIds: [], isSuperAdmin: false }
  }

  // Ensemble ACCESSIBLE = union des portées des appartenances (NODE ou SUBTREE).
  const accessible = new Set<string>()
  for (const m of memberships) visibleOrgIds(m, orgs).forEach(id => accessible.add(id))

  // Organisation active : cookie si accessible (permet la focalisation d'une sous-entité
  // par un membre « groupe » SUBTREE), sinon l'appartenance principale.
  const activeId = cookieOrg && accessible.has(cookieOrg) ? cookieOrg : memberships[0].organizationId
  const activeNode = orgs.find(o => o.id === activeId)
  // Périmètre = sous-arbre de l'org active, restreint à l'accessible.
  const visible = activeNode ? subtreeIds(orgs, activeNode.path).filter(id => accessible.has(id)) : [activeId]

  // Rôle effectif : appartenance directe sur l'org active, sinon appartenance SUBTREE
  // ancêtre qui la couvre, sinon repli sur la principale.
  const direct = memberships.find(m => m.organizationId === activeId)
  const covering = direct ?? memberships.find(m => {
    const n = orgs.find(o => o.id === m.organizationId)
    return m.scope === 'SUBTREE' && n && activeNode ? isInSubtree(activeNode.path, n.path) : false
  })

  return {
    memberships,
    activeOrgId: activeId,
    role: (covering?.role ?? memberships[0].role),
    visibleOrgIds: visible,
    isSuperAdmin: false,
  }
}

/**
 * Ensemble des organisations accessibles à un utilisateur, UNION de toutes ses
 * appartenances (NODE → l'org ; SUBTREE → l'org + descendants). Sert au contrôle
 * d'accès à une analyse par id (au-delà de la seule organisation active).
 * SUPER_ADMIN → `all: true` (toutes).
 */
export async function getAccessibleOrgIds(userId: string, instanceRole: UserRole): Promise<{ all: boolean; ids: string[] }> {
  if (instanceRole === 'SUPER_ADMIN') return { all: true, ids: [] }
  const [memberRows, allOrgs] = await Promise.all([
    prisma.orgMembership.findMany({ where: { userId }, select: { organizationId: true, scope: true } }),
    prisma.organization.findMany({ select: { id: true, path: true, parentId: true } }),
  ])
  const orgs: OrgNode[] = allOrgs.map(o => ({ id: o.id, path: o.path, parentId: o.parentId }))
  const set = new Set<string>()
  for (const m of memberRows) {
    visibleOrgIds({ organizationId: m.organizationId, role: 'ANALYSTE', scope: m.scope as Membership['scope'] }, orgs)
      .forEach(id => set.add(id))
  }
  return { all: false, ids: [...set] }
}

/**
 * Clause WHERE pour charger UNE analyse par id en respectant l'isolation
 * multi-organisation : l'analyse doit appartenir à une organisation accessible,
 * OU être détenue/partagée explicitement avec l'utilisateur (collaboration
 * inter-organisations volontaire). SUPER_ADMIN : aucun filtre d'organisation.
 */
export async function analyseAccessWhere(userId: string, instanceRole: UserRole, id: string): Promise<Record<string, unknown>> {
  const { all, ids } = await getAccessibleOrgIds(userId, instanceRole)
  if (all) return { id }
  return {
    id,
    OR: [
      { organizationId: { in: ids } },
      { userId },
      { accesUtilisateurs: { some: { userId } } },
    ],
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
  // Un SUPER_ADMIN FOCALISÉ sur une organisation (activeOrgId non nul) voit son
  // périmètre restreint (drill-down) ; sans focalisation, il voit tout (isSuperAdmin).
  const noOrgRestriction = ctx.isSuperAdmin && ctx.activeOrgId == null
  return {
    role: (ctx.role ?? instanceRole),
    activeOrgId: ctx.activeOrgId,
    scope: { visibleOrgIds: ctx.visibleOrgIds, isSuperAdmin: noOrgRestriction },
    memberships: ctx.memberships,
  }
}

/**
 * Nombre de membres d'une organisation. Sert à détecter une organisation
 * MONO-UTILISATEUR (cabinet libéral) pour laquelle le principe des quatre-yeux
 * est impossible → auto-validation autorisée (voir `canAutoValidateAnalyse`).
 * Une analyse sans organizationId (héritage) est traitée comme non mono-org (0).
 */
export async function countOrgMembers(organizationId: string | null | undefined): Promise<number> {
  if (!organizationId) return 0
  return prisma.orgMembership.count({ where: { organizationId } })
}
