// ─── SSO SAML 2.0 — cœur pur (MODE MAINTENANCE) ──────────────────────────────
// Fondations testables du SSO SAML : validation de config, reconnaissance de
// certificat PEM, extraction des claims depuis les attributs d'assertion. Le
// flux SAML reste INERTE tant que le mode maintenance n'est pas levé (flag) et
// que la vérification cryptographique de l'assertion (dépendance @node-saml)
// n'est pas câblée + testée avec un IdP réel. Cf. lib/saml.server.ts + doc.

import { isSafeIssuerUrl, type OidcClaims } from '@/lib/sso'

/** Identifiant NextAuth du provider SAML (→ ACS /api/auth/saml/acs). */
export const SAML_PROVIDER_ID = 'saml'

export interface SamlConfigInput {
  samlEntityId?: unknown
  samlSsoUrl?: unknown
  samlCertificate?: unknown
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Vrai si la valeur ressemble à un certificat X.509 au format PEM. */
export function isPemCertificate(cert: unknown): boolean {
  if (typeof cert !== 'string') return false
  return /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(cert)
}

/**
 * Valide une config SAML. Renvoie un code d'erreur i18n ou null.
 * L'URL SSO de l'IdP est appelée côté serveur (redirection) → garde https/SSRF.
 */
export function validateSamlConfig(cfg: SamlConfigInput): string | null {
  if (!str(cfg.samlEntityId)) return 'entity_id_requis'
  if (!isSafeIssuerUrl(str(cfg.samlSsoUrl))) return 'sso_url_invalide'
  if (!isPemCertificate(cfg.samlCertificate)) return 'certificat_invalide'
  return null
}

// Noms d'attributs SAML usuels (Azure AD, ADFS, Okta, Shibboleth…), insensibles
// à la casse. On tente chaque candidat dans l'ordre.
const EMAIL_ATTRS = ['email', 'emailaddress', 'mail', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', 'urn:oid:0.9.2342.19200300.100.1.3']
const NAME_ATTRS = ['name', 'displayname', 'cn', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', 'urn:oid:2.16.840.1.113730.3.1.241']
const GROUP_ATTRS = ['groups', 'memberof', 'http://schemas.xmlsoap.org/claims/group', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups']

function firstAttr(lower: Map<string, string[]>, candidates: string[]): string | undefined {
  for (const c of candidates) {
    const v = lower.get(c)
    if (v && v.length && v[0]) return v[0]
  }
  return undefined
}

/**
 * Extrait { email, name, groups } depuis les attributs d'une assertion SAML.
 * Les attributs peuvent être des chaînes ou des tableaux ; les clés sont
 * comparées en minuscules. Réutilise le type de claims OIDC pour brancher le
 * même provisioning JIT + mapping de rôles que OIDC.
 */
export function extractSamlClaims(attributes: Record<string, unknown>): OidcClaims & { groups: string[] } {
  const lower = new Map<string, string[]>()
  for (const [k, v] of Object.entries(attributes ?? {})) {
    const arr = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : []
    lower.set(k.toLowerCase(), arr)
  }
  const email = firstAttr(lower, EMAIL_ATTRS)
  const name = firstAttr(lower, NAME_ATTRS)
  let groups: string[] = []
  for (const g of GROUP_ATTRS) {
    const v = lower.get(g)
    if (v && v.length) { groups = v; break }
  }
  return { email, name, groups }
}
