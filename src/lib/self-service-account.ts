/** Décision pure de suppression autonome : jamais disponible hors démo ni sans politique explicite. */
export function canSelfDeleteAccount(input: { demo: boolean; enabled: boolean; authenticated: boolean }): boolean {
  return input.demo && input.enabled && input.authenticated
}

/**
 * Une suppression personnelle ne détruit jamais une organisation partagée.
 * Chaque inscrit de démo reçoit une organisation dont il est l'unique membre ;
 * les organisations ayant d'autres membres sont simplement préservées.
 */
export function deletableOrganizationIds(memberships: Array<{ organizationId: string; memberCount: number }>): string[] {
  return memberships
    .filter(membership => membership.organizationId !== 'global' && membership.memberCount === 1)
    .map(membership => membership.organizationId)
}
