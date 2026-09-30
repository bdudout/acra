/**
 * org-context.ts — Multi-organisation hiérarchique : logique pure de l'arbre
 * d'organisations, des appartenances et de la portée (cf. docs/MULTI-ORGANISATION.md).
 *
 * Module SANS dépendance Prisma/React → testé unitairement. Les helpers serveur
 * (lecture DB, cookie d'org active) s'appuient dessus dans org-context.server.ts.
 *
 * Représentation de l'arbre : CHEMIN MATÉRIALISÉ. La racine a `path = "/<id>/"`,
 * un enfant `path = parent.path + "<id>/"`. Le sous-arbre d'une organisation O est
 * l'ensemble des organisations dont le `path` commence par `O.path` (O incluse).
 */

import type { UserRole } from '@/lib/permissions'

/** Portée d'une appartenance : le nœud seul (NODE) ou le nœud et ses descendants (SUBTREE). */
export type OrgScope = 'NODE' | 'SUBTREE'

/** Nœud de l'arbre des organisations (id + parent) pour résoudre les sous-arbres. */
export interface OrgNode {
  id: string
  path: string
  parentId?: string | null
}

/** Appartenance d'un utilisateur à une organisation : rôle effectif + portée (NODE/SUBTREE). */
export interface Membership {
  organizationId: string
  role: UserRole
  scope: OrgScope
}

/** Chemin matérialisé d'une organisation racine : "/<id>/". */
export function rootPath(id: string): string {
  return `/${id}/`
}

/** Chemin d'un enfant : chemin du parent + "<id>/". */
export function childPath(parentPath: string, id: string): string {
  return `${parentPath}${id}/`
}

export type OrganizationReparentingPlan =
  | { ok: true; pathUpdates: Array<{ id: string; path: string }> }
  | { ok: false; reason: 'ORGANIZATION_NOT_FOUND' | 'PARENT_NOT_FOUND' | 'CYCLE' }

export type OrganizationDeletionState = {
  children: number
  memberships: number
  data: number
}

/** La suppression ne doit jamais cascade des données ni casser l'arbre. */
export function organizationDeletionBlocker(
  state: OrganizationDeletionState,
): 'HAS_CHILDREN' | 'HAS_MEMBERS' | 'HAS_DATA' | null {
  if (state.children > 0) return 'HAS_CHILDREN'
  if (state.memberships > 0) return 'HAS_MEMBERS'
  if (state.data > 0) return 'HAS_DATA'
  return null
}

/** Confirmation volontairement stricte pour une fermeture avec effacement des données. */
export function isOrganizationClosureConfirmed(organizationName: string, confirmation: string): boolean {
  return confirmation === organizationName
}

/**
 * Prépare le déplacement d'une organisation dans l'arbre sans modifier la base.
 * Tous les chemins du sous-arbre sont recalculés : la route appelante applique
 * ensuite ce plan dans une transaction.
 */
export function planOrganizationReparenting(
  orgs: OrgNode[],
  id: string,
  newParentId: string | null,
): OrganizationReparentingPlan {
  const org = orgs.find(candidate => candidate.id === id)
  if (!org) return { ok: false, reason: 'ORGANIZATION_NOT_FOUND' }

  const parent = newParentId ? orgs.find(candidate => candidate.id === newParentId) : null
  if (newParentId && !parent) return { ok: false, reason: 'PARENT_NOT_FOUND' }
  if (parent && isInSubtree(parent.path, org.path)) return { ok: false, reason: 'CYCLE' }

  const newPath = parent ? childPath(parent.path, org.id) : rootPath(org.id)
  return {
    ok: true,
    pathUpdates: orgs
      .filter(candidate => isInSubtree(candidate.path, org.path))
      .map(candidate => ({
        id: candidate.id,
        path: `${newPath}${candidate.path.slice(org.path.length)}`,
      })),
  }
}

/** `path` appartient-il au sous-arbre de `ancestorPath` (le nœud lui-même inclus) ? */
export function isInSubtree(path: string, ancestorPath: string): boolean {
  return path === ancestorPath || path.startsWith(ancestorPath)
}

/** `path` est-il un descendant STRICT de `ancestorPath` (nœud lui-même exclu) ? */
export function isStrictDescendant(path: string, ancestorPath: string): boolean {
  return path !== ancestorPath && path.startsWith(ancestorPath)
}

/** Ids des organisations du sous-arbre enraciné en `ancestorPath` (racine incluse). */
export function subtreeIds(orgs: OrgNode[], ancestorPath: string): string[] {
  return orgs.filter(o => isInSubtree(o.path, ancestorPath)).map(o => o.id)
}

/**
 * Organisations visibles pour une appartenance :
 *  - NODE    → uniquement l'organisation du membre ;
 *  - SUBTREE → l'organisation et tout son sous-arbre (vision consolidée groupe).
 * Renvoie `[]` si l'organisation de l'appartenance est introuvable (sécurité).
 */
export function visibleOrgIds(membership: Membership, orgs: OrgNode[]): string[] {
  const node = orgs.find(o => o.id === membership.organizationId)
  if (!node) return []
  if (membership.scope === 'NODE') return [node.id]
  return subtreeIds(orgs, node.path)
}

/**
 * Détermine l'appartenance « active » d'un utilisateur :
 *  - celle dont l'organisation correspond à `requestedOrgId` si elle existe ;
 *  - sinon la première appartenance (organisation principale) ;
 *  - `null` si l'utilisateur n'a aucune appartenance.
 * Ne fait jamais confiance à un `requestedOrgId` hors des appartenances (sécurité).
 */
export function resolveActiveMembership(memberships: Membership[], requestedOrgId?: string | null): Membership | null {
  if (memberships.length === 0) return null
  if (requestedOrgId) {
    const match = memberships.find(m => m.organizationId === requestedOrgId)
    if (match) return match
  }
  return memberships[0]
}

/**
 * Périmètre d'une vue transversale : l'organisation active reste toujours la
 * référence. Seul le SUPER_ADMIN non focalisé peut consulter une consolidation
 * de toutes les organisations visibles. Cela ne confère aucun droit d'écriture
 * sans organisation active explicite.
 */
export function resolvePageOrganizationIds(
  activeOrgId: string | null,
  scope: { visibleOrgIds: string[]; isSuperAdmin?: boolean },
): string[] {
  if (activeOrgId) return [activeOrgId]
  return scope.isSuperAdmin ? scope.visibleOrgIds : []
}
