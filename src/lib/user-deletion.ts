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
