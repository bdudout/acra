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

export type UserRole = 'LECTEUR' | 'ANALYSTE' | 'RISK_MANAGER' | 'RSSI' | 'ADMIN' | 'SUPER_ADMIN' | 'DIRECTION_METIER'
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

/** Rôle « administrateur » (d'organisation OU d'instance). */
export function isAdminRole(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN'
}

/** L'utilisateur peut créer de nouvelles analyses */
export function canCreateAnalyse(user: SessionUser): boolean {
  return user.role === 'ANALYSTE' || isAdminRole(user.role)
}

/**
 * L'utilisateur peut accéder à l'espace /admin scopé à SON organisation (gestion des
 * comptes de son périmètre, corbeille) — ADMIN ou SUPER_ADMIN. Les réglages d'INSTANCE
 * (SMTP, SSO, politique mdp, organisations, démo) et l'audit restent réservés au
 * SUPER_ADMIN (contrôle propre dans chaque route/page). Un ADMIN ne voit jamais les
 * autres organisations ni ne crée de SUPER_ADMIN.
 */
export function canAdmin(user: SessionUser): boolean {
  return isAdminRole(user.role)
}

/** Réglages/vues d'INSTANCE (SMTP, SSO, politique mdp, audit, organisations, démo) — SUPER_ADMIN. */
export function canAdminInstance(user: SessionUser): boolean {
  return user.role === 'SUPER_ADMIN'
}

/** L'utilisateur peut gérer les organisations (niveau instance) — SUPER_ADMIN uniquement */
export function canManageOrganizations(user: SessionUser): boolean {
  return user.role === 'SUPER_ADMIN'
}

/** L'utilisateur peut accéder à la page de configuration (lecture) */
export function canConfigurer(user: SessionUser): boolean {
  return user.role === 'ANALYSTE' || user.role === 'RISK_MANAGER' || user.role === 'RSSI' || isAdminRole(user.role)
}

/** L'utilisateur peut modifier les échelles (gravité, vraisemblance, matrice) — ADMIN uniquement */
export function canEditConfig(user: SessionUser): boolean {
  return isAdminRole(user.role)
}

// ─── Droits sur une analyse spécifique ───────────────────────────────────────

/** Calcule la permission effective sur une analyse pour un utilisateur donné */
function getEffectivePermission(
  user: SessionUser,
  analyse: AnalyseOwnership
): AnalysePermission | null {
  // Admin (organisation ou instance) : accès total
  if (isAdminRole(user.role)) return 'APPROBATION'

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
  if (isAdminRole(user.role) || user.role === 'RISK_MANAGER' || user.role === 'RSSI' || user.role === 'DIRECTION_METIER') return true
  return getEffectivePermission(user, analyse) !== null
}

/**
 * L'utilisateur peut ACCEPTER (ou refuser) les risques résiduels d'une analyse
 * (acceptation du risque, portée globale). Réservé à la DIRECTION_METIER (et aux
 * administrateurs), et uniquement si la fonctionnalité est activée dans la config.
 * Pur → testé unitairement.
 */
export function canAcceptResidualRisks(user: SessionUser, featureActive: boolean): boolean {
  if (!featureActive) return false
  return user.role === 'DIRECTION_METIER' || isAdminRole(user.role)
}

/** L'utilisateur peut modifier les ateliers de l'analyse */
export function canEditAnalyse(user: SessionUser, analyse: AnalyseOwnership): boolean {
  if (isAdminRole(user.role)) return true
  // Le propriétaire peut éditer
  if (analyse.userId === user.id) return user.role === 'ANALYSTE'
  // Accès granulaire EDITION
  const perm = getEffectivePermission(user, analyse)
  return perm === 'EDITION' || perm === 'APPROBATION'
}

/** L'utilisateur peut soumettre l'analyse pour approbation */
export function canSubmitAnalyse(user: SessionUser, analyse: AnalyseOwnership): boolean {
  if (isAdminRole(user.role)) return true
  return analyse.userId === user.id && user.role === 'ANALYSTE'
}

/** L'utilisateur peut approuver ou rejeter l'analyse */
export function canApproveAnalyse(user: SessionUser, analyse: AnalyseOwnership): boolean {
  if (isAdminRole(user.role)) return true
  if (user.role !== 'RISK_MANAGER' && user.role !== 'RSSI') return false
  // Risk Manager / RSSI : peut approuver s'il a un accès APPROBATION ou s'il a accès global
  const acces = analyse.accesUtilisateurs?.find(a => a.userId === user.id)
  // Sans accès granulaire restrictif, ils peuvent approuver toutes les analyses soumises
  return !acces || acces.permission === 'APPROBATION'
}

/** L'utilisateur peut gérer les accès (inviter des collaborateurs) */
export function canManageAccess(user: SessionUser, analyse: AnalyseOwnership): boolean {
  if (isAdminRole(user.role)) return true
  return analyse.userId === user.id
}

// ─── Filtre analyses accessibles ─────────────────────────────────────────────

/**
 * Retourne la clause WHERE Prisma pour ne récupérer que les analyses
 * auxquelles l'utilisateur a accès.
 */
/** Contexte d'organisation pour le filtrage multi-organisation. */
export interface OrgScopeContext {
  /** Organisations visibles (nœud actif + descendants si portée SUBTREE). */
  visibleOrgIds: string[]
  /** Niveau instance : aucune restriction d'organisation. */
  isSuperAdmin?: boolean
}

export function analyseWhereClause(userId: string, role: UserRole, orgCtx?: OrgScopeContext) {
  // Les analyses en corbeille (soft delete) sont masquées de toutes les vues
  // courantes — seul le module admin « Récupération » les requête séparément.
  const notDeleted = { deletedAt: null }
  // Filtre d'organisation (multi-organisation) : restreint au périmètre visible.
  // `isSuperAdmin` du contexte ⇒ aucune restriction (vue « toutes organisations »).
  // Un SUPER_ADMIN qui FOCALISE une organisation a isSuperAdmin=false + visibleOrgIds
  // ciblés → le filtre s'applique (drill-down). Absent ⇒ pas de filtre (mono-org).
  const orgFilter =
    orgCtx && !orgCtx.isSuperAdmin
      ? { organizationId: { in: orgCtx.visibleOrgIds } }
      : {}

  if (isAdminRole(role)) {
    // Admin d'organisation : tout son périmètre. SUPER_ADMIN : tout (orgFilter vide).
    return { ...notDeleted, ...orgFilter }
  }
  if (role === 'RISK_MANAGER' || role === 'RSSI' || role === 'DIRECTION_METIER') {
    return {
      ...notDeleted,
      ...orgFilter,
      OR: [
        { userId },
        { accesUtilisateurs: { some: { userId } } },
        // Risk Managers, RSSI et Direction métier voient aussi les analyses soumises/approuvées/rejetées
        { statut: 'SOUMIS'   as const },
        { statut: 'APPROUVE' as const },
        { statut: 'REJETE'   as const },
      ],
    }
  }
  // LECTEUR et ANALYSTE : propres analyses + partagées
  return {
    ...notDeleted,
    ...orgFilter,
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
  SUPER_ADMIN:  'Super-administrateur',
  DIRECTION_METIER: 'Direction métier',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  LECTEUR:      'Consultation en lecture seule des analyses partagées',
  ANALYSTE:     'Création et édition de ses propres analyses de risques',
  RISK_MANAGER: 'Valide le périmètre métier et le niveau de risque — approuve les analyses (sans expertise technique SSI requise)',
  RSSI:         'Responsable SSI — apporte l\'expertise technique sécurité et approuve les analyses',
  ADMIN:        'Administre SON organisation : gère les comptes de son périmètre et les analyses. Pas les réglages d\'instance (SMTP, SSO, politique mdp), ni les autres organisations, ni la création de super-administrateurs',
  SUPER_ADMIN:  'Niveau instance : réglages globaux (SMTP, SSO, politique mdp), gestion des organisations et de tous les comptes, journal d\'audit, traverse tous les périmètres',
  DIRECTION_METIER: 'Direction métier — consulte les analyses en lecture seule et accepte (ou refuse) les risques résiduels (acceptation du risque), distincte de la validation de l\'analyse',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  LECTEUR:      'bg-gray-100 text-gray-700',
  ANALYSTE:     'bg-blue-100 text-blue-700',
  RISK_MANAGER: 'bg-amber-100 text-amber-800',
  RSSI:         'bg-purple-100 text-purple-800',
  ADMIN:        'bg-red-100 text-red-700',
  SUPER_ADMIN:  'bg-slate-800 text-white',
  DIRECTION_METIER: 'bg-cyan-100 text-cyan-800',
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
