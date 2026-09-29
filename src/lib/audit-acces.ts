/** Droits de l'audit interne (lot L4). Module PUR : l'audit écrit, tous les autres rôles lisent. */
import { isAdminRole, type UserRole } from './permissions'

export const peutEcrireAudit = (role: UserRole): boolean => role === 'AUDITEUR' || isAdminRole(role)
