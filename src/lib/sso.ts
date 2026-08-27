// ─── SSO d'entreprise (OIDC) — cœur pur ──────────────────────────────────────
// Logique testable sans DB ni IdP, au service du câblage NextAuth de la config
// d'instance `SSOConfig` (singleton 'global') : garde SSRF sur l'issuer,
// résolution/allowlist de domaine e-mail, décision de provisioning JIT.

import { isSafeWebhookUrl } from '@/lib/webhook'

/** Rôle par défaut le plus prudent pour un utilisateur provisionné automatiquement. */
export const SSO_DEFAULT_ROLE = 'ANALYSTE'
/** Identifiant NextAuth du provider SSO (→ callback /api/auth/callback/sso). */
export const SSO_PROVIDER_ID = 'sso'

/** L'issuer est appelé côté serveur (discovery OIDC) → même garde SSRF que les webhooks. */
export function isSafeIssuerUrl(url: unknown): boolean {
  return isSafeWebhookUrl(url)
}

/** Domaine (minuscule) d'un e-mail, ou null si invalide. */
export function emailDomain(email: unknown): string | null {
  if (typeof email !== 'string') return null
  const m = email.trim().toLowerCase().match(/^[^@\s]+@([^@\s]+)$/)
  return m ? m[1] : null
}

/** Parse la liste de domaines autorisés (séparés par virgule/point-virgule/espace). */
export function parseAllowedDomains(input: unknown): string[] {
  if (typeof input !== 'string') return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input.split(/[,;\s]+/)) {
    const d = raw.trim().toLowerCase().replace(/^@/, '')
    if (d && !seen.has(d)) { seen.add(d); out.push(d) }
  }
  return out
}

/**
 * Domaine de l'e-mail autorisé par la config ? Liste VIDE = tous les domaines
 * autorisés (comportement documenté de l'UI). E-mail invalide → refusé.
 */
export function emailDomainAllowed(email: unknown, allowedDomains: unknown): boolean {
  const dom = emailDomain(email)
  if (!dom) return false
  const list = parseAllowedDomains(allowedDomains)
  return list.length === 0 || list.includes(dom)
}

// ─── RBAC piloté par l'IdP : mapping groupes → rôles ACRA ────────────────────
// Permet à un AD / SailPoint / Okta de gouverner les droits : les groupes de
// l'utilisateur sont dans le jeton, mappés à un rôle ACRA à chaque connexion.

/** Rôles assignables par SSO (SUPER_ADMIN EXCLU : réglage d'instance sensible). */
export const SSO_ASSIGNABLE_ROLES = [
  'LECTEUR', 'METIER', 'DPO', 'CONFORMITE', 'CONTROLEUR', 'AUDITEUR',
  'ANALYSTE', 'DIRECTION_METIER', 'RISK_MANAGER', 'RSSI', 'ADMIN',
] as const

// Rang de privilège pour départager plusieurs groupes (le plus élevé gagne).
const ROLE_RANK: Record<string, number> = {
  LECTEUR: 0, METIER: 1, DPO: 1, CONFORMITE: 2, CONTROLEUR: 2, AUDITEUR: 2,
  ANALYSTE: 3, DIRECTION_METIER: 4, RISK_MANAGER: 5, RSSI: 6, ADMIN: 7,
}

/** Normalise une valeur de groupes (tableau, ou chaîne séparée) en liste. */
export function normalizeGroups(groups: unknown): string[] {
  if (Array.isArray(groups)) return groups.filter((g): g is string => typeof g === 'string' && g.trim() !== '').map(g => g.trim())
  if (typeof groups === 'string') return groups.split(/[,;\n]/).map(g => g.trim()).filter(Boolean)
  return []
}

/**
 * Parse un texte « groupe = RÔLE » (une paire par ligne) en table de mapping.
 * Ne conserve que les rôles assignables par SSO ; ignore les lignes invalides.
 */
export function cleanRoleMapping(input: unknown): Record<string, string> {
  const allowed = new Set<string>(SSO_ASSIGNABLE_ROLES)
  const out: Record<string, string> = {}
  const consume = (group: string, role: string) => {
    const g = group.trim()
    const r = role.trim().toUpperCase()
    if (g && allowed.has(r)) out[g] = r
  }
  if (typeof input === 'string') {
    for (const line of input.split('\n')) {
      const i = line.indexOf('=')
      if (i > 0) consume(line.slice(0, i), line.slice(i + 1))
    }
  } else if (input && typeof input === 'object') {
    for (const [g, r] of Object.entries(input as Record<string, unknown>)) {
      if (typeof r === 'string') consume(g, r)
    }
  }
  return out
}

/**
 * Résout le rôle ACRA depuis les groupes de l'IdP et la table de mapping.
 * - mapping vide/absent → null (pas de gouvernance par groupes : ne rien forcer).
 * - au moins un groupe mappé → rôle de plus haut privilège.
 * - mapping configuré mais aucun groupe mappé → `defaultRole` (moindre privilège voulu).
 * Comparaison des groupes insensible à la casse.
 */
export function resolveSsoRole(groups: unknown, mapping: unknown, defaultRole: string): string | null {
  const table = cleanRoleMapping(mapping)
  if (Object.keys(table).length === 0) return null
  const lower = new Map(Object.entries(table).map(([k, v]) => [k.toLowerCase(), v]))
  const matched: string[] = []
  for (const g of normalizeGroups(groups)) {
    const r = lower.get(g.toLowerCase())
    if (r) matched.push(r)
  }
  if (matched.length === 0) return defaultRole
  return matched.sort((a, b) => (ROLE_RANK[b] ?? -1) - (ROLE_RANK[a] ?? -1))[0]
}

export interface OidcClaims { email?: string; name?: string; email_verified?: boolean }
export interface SsoJitConfig { autoProvision: boolean; defaultRole: string; allowedDomains: string | null }
export type JitDecision =
  | { action: 'link'; email: string; name: string | null }
  | { action: 'create'; email: string; name: string | null; role: string }
  | { action: 'deny'; reason: string }

/**
 * Décide le provisioning JIT à partir des claims OIDC et de l'existence d'un
 * utilisateur. Refuse : e-mail absent/invalide, domaine non autorisé, e-mail non
 * vérifié, ou création interdite (autoProvision off) sans utilisateur existant.
 */
export function resolveJitProvisioning(config: SsoJitConfig, claims: OidcClaims, userExists: boolean): JitDecision {
  const dom = emailDomain(claims.email)
  if (!dom) return { action: 'deny', reason: 'email_absent' }
  const email = (claims.email as string).trim().toLowerCase()
  if (!emailDomainAllowed(email, config.allowedDomains)) return { action: 'deny', reason: 'domaine_non_autorise' }
  if (claims.email_verified === false) return { action: 'deny', reason: 'email_non_verifie' }
  const name = typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : null
  if (userExists) return { action: 'link', email, name }
  if (!config.autoProvision) return { action: 'deny', reason: 'provisioning_desactive' }
  return { action: 'create', email, name, role: config.defaultRole || SSO_DEFAULT_ROLE }
}
