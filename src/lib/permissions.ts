/**
 * permissions.ts — Helpers centralisés pour le contrôle d'accès RBAC
 *
 * Matrice des droits :
 * ┌─────────────────────────────┬─────────┬──────────┬──────────────┬──────┬───────┐
 * │ Action                      │ LECTEUR │ ANALYSTE │ RISK_MANAGER │ RSSI │ ADMIN │
 * ├─────────────────────────────┼─────────┼──────────┼──────────────┼──────┼───────┤
 * │ Voir ses analyses           │ ✅      │ ✅       │ ✅           │ ✅   │ ✅    │
 * │ Voir analyses partagées     │ ✅      │ ✅       │ ✅           │ ✅   │ ✅    │
 * │ Créer une analyse           │ ❌      │ ✅       │ ❌           │ ❌   │ ✅    │
 * │ Éditer une analyse          │ ❌      │ ✅(own)  │ ❌           │ ❌   │ ✅    │
 * │ Soumettre pour approbation  │ ❌      │ ✅       │ ❌           │ ❌   │ ✅    │
 * │ Approuver / Rejeter         │ ❌      │ ❌       │ ✅           │ ✅   │ ✅    │
 * │ Gérer les accès             │ ❌      │ ✅(own)  │ ❌           │ ❌   │ ✅    │
 * │ Administrer les utilisateurs│ ❌      │ ❌       │ ❌           │ ❌   │ ✅    │
 * └─────────────────────────────┴─────────┴──────────┴──────────────┴──────┴───────┘
 *
 * Les accès granulaires par analyse peuvent étendre ces droits :
 *  - LECTURE     → peut voir l'analyse (sans pouvoir éditer)
 *  - EDITION     → peut éditer l'analyse (même si LECTEUR global)
 *  - APPROBATION → peut approuver (utilisé pour les Risk Managers sur une analyse spécifique)
 */

export type UserRole = 'LECTEUR' | 'ANALYSTE' | 'RISK_MANAGER' | 'RSSI' | 'ADMIN'
export type AnalysePermission = 'LECTURE' | 'EDITION' | 'APPROBATION'

export interface SessionUser {
  id: string
  role: UserRole
}

export interface AnalyseOwnership {
  userId: string          // propriétaire
  accesUtilisateurs?: {   // accès granulaires
    userId: string
    permission: AnalysePermission
  }[]
}

// ─── Droits globaux ──────────────────────────────────────────────────────────

/** L'utilisateur peut créer de nouvelles analyses */
export function canCreateAnalyse(user: SessionUser): boolean {
  return user.role === 'ANALYSTE' || user.role === 'ADMIN'
}

/** L'utilisateur peut administrer les comptes (page /admin) */
export function canAdmin(user: SessionUser): boolean {
  return user.role === 'ADMIN'
}

/** L'utilisateur peut accéder à la page de configuration (lecture) */
export function canConfigurer(user: SessionUser): boolean {
  return user.role === 'ANALYSTE' || user.role === 'RISK_MANAGER' || user.role === 'RSSI' || user.role === 'ADMIN'
}

/** L'utilisateur peut modifier les échelles (gravité, vraisemblance, matrice) — ADMIN uniquement */
export function canEditConfig(user: SessionUser): boolean {
  return user.role === 'ADMIN'
}

// ─── Droits sur une analyse spécifique ───────────────────────────────────────

/** Calcule la permission effective sur une analyse pour un utilisateur donné */
function getEffectivePermission(
  user: SessionUser,
  analyse: AnalyseOwnership
): AnalysePermission | null {
  // Admin : accès total
  if (user.role === 'ADMIN') return 'APPROBATION'

  // Propriétaire : accès total (sauf approbation de sa propre analyse)
  if (analyse.userId === user.id) return 'EDITION'

  // Accès granulaire explicite
  const acces = analyse.accesUtilisateurs?.find(a => a.userId === user.id)
  if (acces) return acces.permission

  // Risk Manager peut voir toutes les analyses soumises (accès LECTURE implicite)
  // mais on ne peut pas le déterminer ici sans le statut — géré dans getAnalysesAccessibles

  return null
}

/** L'utilisateur peut visualiser l'analyse */
export function canViewAnalyse(user: SessionUser, analyse: AnalyseOwnership): boolean {
  if (user.role === 'ADMIN' || user.role === 'RISK_MANAGER' || user.role === 'RSSI') return true
  return getEffectivePermission(user, analyse) !== null
}

/** L'utilisateur peut modifier les ateliers de l'analyse */
export function canEditAnalyse(user: SessionUser, analyse: AnalyseOwnership): boolean {
  if (user.role === 'ADMIN') return true
  // Le propriétaire peut éditer
  if (analyse.userId === user.id) return user.role === 'ANALYSTE'
  // Accès granulaire EDITION
  const perm = getEffectivePermission(user, analyse)
  return perm === 'EDITION' || perm === 'APPROBATION'
}

/** L'utilisateur peut soumettre l'analyse pour approbation */
export function canSubmitAnalyse(user: SessionUser, analyse: AnalyseOwnership): boolean {
  if (user.role === 'ADMIN') return true
  return analyse.userId === user.id && user.role === 'ANALYSTE'
}

/** L'utilisateur peut approuver ou rejeter l'analyse */
export function canApproveAnalyse(user: SessionUser, analyse: AnalyseOwnership): boolean {
  if (user.role === 'ADMIN') return true
  if (user.role !== 'RISK_MANAGER' && user.role !== 'RSSI') return false
  // Risk Manager / RSSI : peut approuver s'il a un accès APPROBATION ou s'il a accès global
  const acces = analyse.accesUtilisateurs?.find(a => a.userId === user.id)
  // Sans accès granulaire restrictif, ils peuvent approuver toutes les analyses soumises
  return !acces || acces.permission === 'APPROBATION'
}

/** L'utilisateur peut gérer les accès (inviter des collaborateurs) */
export function canManageAccess(user: SessionUser, analyse: AnalyseOwnership): boolean {
  if (user.role === 'ADMIN') return true
  return analyse.userId === user.id
}

// ─── Filtre analyses accessibles ─────────────────────────────────────────────

/**
 * Retourne la clause WHERE Prisma pour ne récupérer que les analyses
 * auxquelles l'utilisateur a accès.
 */
export function analyseWhereClause(userId: string, role: UserRole) {
  if (role === 'ADMIN') {
    return {} // tout
  }
  if (role === 'RISK_MANAGER' || role === 'RSSI') {
    return {
      OR: [
        { userId },
        { accesUtilisateurs: { some: { userId } } },
        // Les Risk Managers et RSSI voient aussi les analyses soumises/approuvées/rejetées
        { statut: 'SOUMIS'   as const },
        { statut: 'APPROUVE' as const },
        { statut: 'REJETE'   as const },
      ],
    }
  }
  // LECTEUR et ANALYSTE : propres analyses + partagées
  return {
    OR: [
      { userId },
      { accesUtilisateurs: { some: { userId } } },
    ],
  }
}

// ─── Labels pour l'UI ────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<UserRole, string> = {
  LECTEUR:      'Lecteur',
  ANALYSTE:     'Analyste Risque',
  RISK_MANAGER: 'Risk Manager',
  RSSI:         'RSSI',
  ADMIN:        'Administrateur',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  LECTEUR:      'Consultation en lecture seule des analyses partagées',
  ANALYSTE:     'Création et édition de ses propres analyses de risques',
  RISK_MANAGER: 'Approbation et validation des analyses soumises',
  RSSI:         'Responsable SSI — approbation et validation des analyses soumises',
  ADMIN:        'Administration complète — accès à tous les comptes et analyses',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  LECTEUR:      'bg-gray-100 text-gray-700',
  ANALYSTE:     'bg-blue-100 text-blue-700',
  RISK_MANAGER: 'bg-amber-100 text-amber-800',
  RSSI:         'bg-purple-100 text-purple-800',
  ADMIN:        'bg-red-100 text-red-700',
}

export const PERMISSION_LABELS: Record<AnalysePermission, string> = {
  LECTURE:     'Lecture seule',
  EDITION:     'Édition',
  APPROBATION: 'Approbation',
}

export const PERMISSION_DESCRIPTIONS: Record<AnalysePermission, string> = {
  LECTURE:     'Peut consulter l\'analyse mais pas la modifier',
  EDITION:     'Peut modifier les ateliers de l\'analyse',
  APPROBATION: 'Peut soumettre, approuver ou rejeter l\'analyse',
}

export const STATUT_APPROBATION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  EN_COURS: { label: 'En cours',  color: 'bg-orange-100 text-orange-700', icon: '⚙️' },
  SOUMIS:   { label: 'Soumis',    color: 'bg-blue-100 text-blue-700',     icon: '📤' },
  APPROUVE: { label: 'Approuvé',  color: 'bg-green-100 text-green-700',   icon: '✅' },
  REJETE:   { label: 'Rejeté',    color: 'bg-red-100 text-red-700',       icon: '❌' },
  TERMINE:  { label: 'Terminée',  color: 'bg-green-100 text-green-700',   icon: '✅' },
  ARCHIVE:  { label: 'Archivée',  color: 'bg-gray-100 text-gray-600',     icon: '📦' },
}
