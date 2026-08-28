// ─── Organisation active — utilitaire pur ────────────────────────────────────

interface NamedMembership { organizationId: string; nom: string }

/**
 * Nom de l'organisation active exploitable comme DÉFAUT de saisie, ou null.
 * Cherche le nom dans les appartenances de l'utilisateur (source fiable :
 * getAnalyseScope). Renvoie null pour l'org racine générique ('global') — son
 * libellé n'est pas un nom d'organisation à pré-remplir. Pur → testable.
 */
export function orgNameForPrefill(
  activeOrgId: string | null | undefined,
  memberships: NamedMembership[] | null | undefined,
): string | null {
  if (!activeOrgId || activeOrgId === 'global') return null
  const nom = (memberships ?? []).find(m => m.organizationId === activeOrgId)?.nom
  return typeof nom === 'string' && nom.trim() ? nom.trim() : null
}
