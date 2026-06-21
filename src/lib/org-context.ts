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

export type OrgScope = 'NODE' | 'SUBTREE'

export interface OrgNode {
  id: string
  path: string
  parentId?: string | null
}

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
