// ─── Décision de suppression définitive d'un compte (PUR) ────────────────────
// Audit 2026-09-30 (S1, S4, D1). Règles, dans l'ordre :
//  1. un compte SUPER_ADMIN n'est supprimable que par un SUPER_ADMIN, et jamais
//     s'il est le dernier actif (mêmes garde-fous que le changement de rôle) ;
//  2. un administrateur à périmètre restreint ne supprime pas un compte qui
//     appartient AUSSI à des organisations hors de son périmètre : il ne retire
//     que les appartenances de son périmètre (le compte survit ailleurs) ;
//  3. un compte encore propriétaire d'analyses n'est pas supprimé (les analyses
//     sont des preuves GRC) : désactiver le compte ou réattribuer ses analyses.

export type UserDeletionDecision =
  | { action: 'DELETE' }
  | { action: 'DETACH'; organizationIds: string[] }
  | { action: 'REFUSE'; status: 400 | 403 | 409; code: 'SUPER_ADMIN_ONLY' | 'LAST_SUPER_ADMIN' | 'OUT_OF_SCOPE' | 'OWNS_ANALYSES' }

export function decideUserDeletion(input: {
  actorRole: string
  /** Périmètre complet (SUPER_ADMIN non focalisé). */
  actorAll: boolean
  actorVisibleOrgIds: string[]
  targetRole: string
  targetMembershipOrgIds: string[]
  /** SUPER_ADMIN actifs AUTRES que la cible. */
  otherActiveSuperAdmins: number
  ownedAnalyses: number
}): UserDeletionDecision {
  if (input.targetRole === 'SUPER_ADMIN') {
    if (input.actorRole !== 'SUPER_ADMIN') return { action: 'REFUSE', status: 403, code: 'SUPER_ADMIN_ONLY' }
    if (input.otherActiveSuperAdmins < 1) return { action: 'REFUSE', status: 400, code: 'LAST_SUPER_ADMIN' }
  }
  if (!input.actorAll) {
    const visible = new Set(input.actorVisibleOrgIds)
    const inScope = input.targetMembershipOrgIds.filter(id => visible.has(id))
    if (inScope.length === 0) return { action: 'REFUSE', status: 403, code: 'OUT_OF_SCOPE' }
    if (inScope.length < input.targetMembershipOrgIds.length) return { action: 'DETACH', organizationIds: inScope }
  }
  if (input.ownedAnalyses > 0) return { action: 'REFUSE', status: 409, code: 'OWNS_ANALYSES' }
  return { action: 'DELETE' }
}

// ─── Actions GLOBALES sur un compte (PATCH /api/admin/users) ─────────────────
// Audit 2026-10-01 (T1). `User.role`, `User.isActive` et le mot de passe sont
// GLOBAUX : les modifier affecte toutes les organisations du compte. Un admin à
// périmètre restreint ne peut donc agir que sur un compte entièrement dans son
// périmètre ; un SUPER_ADMIN n'est gérable que par un SUPER_ADMIN. Sans cela,
// `reset-password` (qui renvoie le mot de passe temporaire à l'admin) permettait
// de prendre la main sur un SUPER_ADMIN ou sur un compte d'une autre organisation.

export type UserManagementDecision =
  | { allowed: true }
  | { allowed: false; status: 403; code: 'SUPER_ADMIN_ONLY' | 'OUT_OF_SCOPE' | 'SHARED_ACCOUNT' }

export function decideUserManagement(input: {
  actorRole: string
  actorAll: boolean
  actorVisibleOrgIds: string[]
  targetRole: string
  targetMembershipOrgIds: string[]
}): UserManagementDecision {
  if (input.targetRole === 'SUPER_ADMIN' && input.actorRole !== 'SUPER_ADMIN') return { allowed: false, status: 403, code: 'SUPER_ADMIN_ONLY' }
  if (input.actorAll) return { allowed: true }
  const visible = new Set(input.actorVisibleOrgIds)
  const inScope = input.targetMembershipOrgIds.filter(id => visible.has(id))
  if (inScope.length === 0) return { allowed: false, status: 403, code: 'OUT_OF_SCOPE' }
  if (inScope.length < input.targetMembershipOrgIds.length) return { allowed: false, status: 403, code: 'SHARED_ACCOUNT' }
  return { allowed: true }
}
