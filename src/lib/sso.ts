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
