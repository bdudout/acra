// ─── Administrateur « effectif » côté interface (PUR) ─────────────────────────────────────────────────────────────────────
// Les API décident d'après le rôle de l'utilisateur DANS l'organisation active ; l'interface doit afficher les mêmes options.
// `activeRole` : rôle effectif connu (`null` = aucune appartenance) ; `undefined` = pas encore chargé → repli sur le rôle de session.

import { isAdminRole, type UserRole } from './permissions'

export function resolveIsAdmin(sessionRole: string | null | undefined, activeRole: string | null | undefined): boolean {
  if (activeRole === undefined) return isAdminRole((sessionRole ?? 'LECTEUR') as UserRole)
  if (activeRole === null) return false
  return isAdminRole(activeRole as UserRole)
}
