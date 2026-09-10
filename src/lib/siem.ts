// ─── Transfert des journaux de sécurité vers un SIEM ─────────────────────────
// Émission configurable (journal par journal) des événements d'audit/sécurité
// vers un SIEM externe (Splunk HEC, Elastic, syslog-HTTP, webhook d'ingestion…).
// Le point d'audit unique `auditLog` (lib/logger) déclenche le transfert. Ce
// module est PUR : classification des actions en « journaux » (catégories),
// validation de la config, décision d'émission et mise en forme de l'événement.
// La livraison réseau + la lecture de la config vivent dans siem.server.ts.
//
// Reco d'origine (backlog comité) : réutiliser l'émission HTTP (webhooks #50) +
// le JSON structuré déjà produit par le logger en production. Cf. [[acra-backlog-comite-2]].

import type { AuditAction } from './logger'

/** Journaux de sécurité activables indépendamment (« journal par journal »). */
export const SIEM_CATEGORIES = ['AUTHENTIFICATION', 'COMPTES', 'CONFIGURATION', 'DONNEES', 'GOUVERNANCE'] as const
export type SiemCategory = (typeof SIEM_CATEGORIES)[number]

/** Classement de chaque action d'audit dans un journal de sécurité (exhaustif). */
const CATEGORY: Record<AuditAction, SiemCategory> = {
  // Authentification & accès au compte
  LOGIN_SUCCESS: 'AUTHENTIFICATION', LOGIN_FAILED: 'AUTHENTIFICATION', LOGIN_RATE_LIMITED: 'AUTHENTIFICATION',
  LOGIN_LOCKED: 'AUTHENTIFICATION', LOGOUT: 'AUTHENTIFICATION', REGISTER: 'AUTHENTIFICATION',
  PASSWORD_CHANGED: 'AUTHENTIFICATION', MFA_AUTO_DISABLED: 'AUTHENTIFICATION', MFA_CONFIRMED: 'AUTHENTIFICATION',
  MFA_CHALLENGE_SENT: 'AUTHENTIFICATION', MFA_VERIFIED: 'AUTHENTIFICATION',
  EMAIL_VERIFICATION_SENT: 'AUTHENTIFICATION', EMAIL_VERIFIED: 'AUTHENTIFICATION',
  // Comptes & habilitations
  ROLE_CHANGED: 'COMPTES', USER_DELETED: 'COMPTES', USER_CREATED: 'COMPTES', USERS_BULK_IMPORTED: 'COMPTES',
  USER_SUSPENDED: 'COMPTES', USER_ACTIVATED: 'COMPTES', ACCESS_GRANTED: 'COMPTES', ACCESS_REVOKED: 'COMPTES',
  PROFILE_UPDATED: 'COMPTES', ORG_MEMBER_ADDED: 'COMPTES', ORG_MEMBER_REMOVED: 'COMPTES',
  // Configuration (sécurité & instance)
  PASSWORD_POLICY_UPDATED: 'CONFIGURATION', SSO_CONFIG_UPDATED: 'CONFIGURATION', SMTP_CONFIG_UPDATED: 'CONFIGURATION',
  SMTP_TEST_SENT: 'CONFIGURATION', SIEM_CONFIG_UPDATED: 'CONFIGURATION', SOCLE_TOGGLED: 'CONFIGURATION', ORGANIZATION_CONFIG_UPDATED: 'CONFIGURATION',
  DEMO_CONFIG_UPDATED: 'CONFIGURATION', ADMIN_ACTION: 'CONFIGURATION', ORG_CREATED: 'CONFIGURATION',
  ORG_UPDATED: 'CONFIGURATION', DEMO_ORG_PURGED: 'CONFIGURATION', DEMO_ORG_WARNED: 'CONFIGURATION',
  DEMO_MODE_REFUSED: 'CONFIGURATION',
  // Données & exports (accès/traitement de données)
  EXPORT: 'DONNEES', ANALYSE_CREATED: 'DONNEES', ANALYSE_DELETED: 'DONNEES', ANALYSE_RESTORED: 'DONNEES',
  ANALYSE_PURGED: 'DONNEES', WORKSHOP_SAVED: 'DONNEES', TIERS_MERGED: 'DONNEES',
  // Gouvernance & GRC (piste d'audit décisionnelle)
  ANALYSE_APPROVED: 'GOUVERNANCE', ANALYSE_REJECTED: 'GOUVERNANCE', ANALYSE_SUBMITTED: 'GOUVERNANCE',
  ANALYSE_REVISED: 'GOUVERNANCE', RESIDUAL_RISKS_DECISION: 'GOUVERNANCE',
  DEROGATION_REQUESTED: 'GOUVERNANCE', DEROGATION_RSSI_OPINION: 'GOUVERNANCE', DEROGATION_DOUBLE_REVIEW: 'GOUVERNANCE',
  DEROGATION_VALIDATED: 'GOUVERNANCE', DEROGATION_REJECTED: 'GOUVERNANCE', DEROGATION_EXTENDED: 'GOUVERNANCE',
  DEROGATION_CLOSED: 'GOUVERNANCE', DEROGATION_REVOKED: 'GOUVERNANCE', DEROGATION_EXPIRING: 'GOUVERNANCE',
  DEROGATION_EXPIRED: 'GOUVERNANCE',
}

export function categoryForAction(action: AuditAction): SiemCategory {
  return CATEGORY[action] ?? 'CONFIGURATION'
}

// L'action ORGANIZATION_CONFIG_UPDATED est un fourre-tout historique : la plupart
// des écritures de données GRC (documents, registres, incidents, missions…) la
// réutilisent en portant leur vraie nature dans `details.scope`. Sans affinage,
// une SUPPRESSION de document serait classée « CONFIGURATION » côté SIEM. On
// reclasse donc par scope les événements de données métier vers DONNEES ; les
// scopes de configuration/sécurité réels restent CONFIGURATION (défaut).
const SCOPE_CATEGORY: Record<string, SiemCategory> = {
  document: 'DONNEES', ropa: 'DONNEES', 'risk-item': 'DONNEES', 'risk-action': 'DONNEES',
  incident: 'DONNEES', 'registre-tic': 'DONNEES', processus: 'DONNEES', referentiel: 'DONNEES',
  'audit-mission': 'DONNEES', 'audit-constat': 'DONNEES', 'campagne-controle': 'DONNEES',
  controle: 'DONNEES', campagne: 'DONNEES', 'campagne-evaluation': 'DONNEES', kri: 'DONNEES',
  'kri-mesure': 'DONNEES', 'reglementaire-dora': 'DONNEES', 'rapport-controle-interne': 'DONNEES',
  'comite-pack': 'DONNEES', 'appetit-risque': 'DONNEES', 'appetit-ras': 'DONNEES', 'api-import': 'DONNEES',
  // Non listés (branding, public-signup, api-key, webhook, scim, modules-policy…) → CONFIGURATION.
}

/**
 * Catégorie EFFECTIVE d'un événement : comme categoryForAction, mais affine
 * l'action générique ORGANIZATION_CONFIG_UPDATED selon `details.scope` pour
 * router les opérations de données métier vers le journal DONNEES.
 */
export function categoryForEvent(action: AuditAction, details?: Record<string, unknown>): SiemCategory {
  if (action === 'ORGANIZATION_CONFIG_UPDATED') {
    const scope = typeof details?.scope === 'string' ? details.scope : undefined
    if (scope && SCOPE_CATEGORY[scope]) return SCOPE_CATEGORY[scope]
  }
  return categoryForAction(action)
}

export type SiemSeverity = 'info' | 'warning'
// Actions à surveiller (échecs d'auth, suppression/rejet) → warning ; sinon info.
const WARN_ACTIONS = new Set<AuditAction>([
  'LOGIN_FAILED', 'LOGIN_RATE_LIMITED', 'LOGIN_LOCKED', 'USER_DELETED', 'USER_SUSPENDED',
  'ACCESS_REVOKED', 'ANALYSE_DELETED', 'ANALYSE_PURGED', 'DEROGATION_REJECTED', 'DEROGATION_REVOKED',
  'MFA_AUTO_DISABLED', 'DEMO_MODE_REFUSED',
])
export function severityForAction(action: AuditAction): SiemSeverity {
  return WARN_ACTIONS.has(action) ? 'warning' : 'info'
}

/** Ne conserve que des codes de catégorie connus, dédupliqués. */
export function cleanSiemCategories(v: unknown): SiemCategory[] {
  const arr = Array.isArray(v) ? v : []
  const out = new Set<SiemCategory>()
  for (const c of arr) if ((SIEM_CATEGORIES as readonly string[]).includes(String(c))) out.add(String(c) as SiemCategory)
  return [...out]
}

/** URL d'ingestion valide (http/https uniquement). */
export function isValidSiemEndpoint(url: unknown): boolean {
  if (typeof url !== 'string' || !url.trim()) return false
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export interface SiemConfigLite {
  enabled: boolean
  endpoint?: string | null
  categories: string[]
}

/** Décide si une action doit être transférée au SIEM selon la config. Le `details`
 * optionnel permet d'affiner la catégorie (scope) — cohérent avec buildSiemEvent. */
export function shouldForward(cfg: SiemConfigLite, action: AuditAction, details?: Record<string, unknown>): boolean {
  if (!cfg.enabled) return false
  if (!isValidSiemEndpoint(cfg.endpoint ?? '')) return false
  return cleanSiemCategories(cfg.categories).includes(categoryForEvent(action, details))
}

export interface SiemEventCtx {
  userId?: string
  userEmail?: string
  userRole?: string
  targetId?: string
  targetType?: string
  ip?: string
  organizationId?: string | null
  details?: Record<string, unknown>
}

export interface SiemEvent {
  source: 'acra'
  timestamp: string
  action: AuditAction
  category: SiemCategory
  severity: SiemSeverity
  userId?: string
  userEmail?: string
  userRole?: string
  targetId?: string
  targetType?: string
  ip?: string
  organizationId?: string | null
  details?: Record<string, unknown>
}

/** Met en forme un événement SIEM normalisé (JSON structuré). */
export function buildSiemEvent(action: AuditAction, ctx: SiemEventCtx, now: Date = new Date()): SiemEvent {
  return {
    source: 'acra',
    timestamp: now.toISOString(),
    action,
    category: categoryForEvent(action, ctx.details),
    severity: severityForAction(action),
    userId: ctx.userId,
    userEmail: ctx.userEmail,
    userRole: ctx.userRole,
    targetId: ctx.targetId,
    targetType: ctx.targetType,
    ip: ctx.ip,
    organizationId: ctx.organizationId ?? null,
    details: ctx.details,
  }
}
