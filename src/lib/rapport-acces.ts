/** Droits sur les rapports GRC (lot L2). Module PUR. */
import { hasGlobalReadDispositif, isAdminRole, type UserRole } from './permissions'

/** Lecture : rôles à lecture globale du dispositif (comme le cockpit /pilotage). */
export const peutLireRapports = (role: UserRole): boolean => hasGlobalReadDispositif(role)
/** Génération, relecture, validation, diffusion : administrateur, risk manager, RSSI. */
export const peutEcrireRapports = (role: UserRole): boolean => isAdminRole(role) || role === 'RISK_MANAGER' || role === 'RSSI'
