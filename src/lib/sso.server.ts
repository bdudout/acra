// ─── SSO OIDC — couche serveur (câblage NextAuth de la config d'instance) ─────
// Lit le singleton SSOConfig 'global' (réglé dans /admin/security), déchiffre le
// secret, construit le provider OIDC NextAuth et applique le provisioning JIT.
// TOUT est gardé : SSO désactivé (défaut) ⇒ aucun provider ajouté, aucun effet.

import type { OAuthConfig } from 'next-auth/providers/oauth'
import { prisma } from '@/lib/prisma'
import { decryptSecret } from '@/lib/secret-crypto'
import { auditLog } from '@/lib/logger'
import {
  isSafeIssuerUrl,
  resolveJitProvisioning,
  SSO_PROVIDER_ID,
  type OidcClaims,
} from '@/lib/sso'

export interface SsoOidcConfig {
  issuer: string
  clientId: string
  clientSecret: string
  scopes: string
  autoProvision: boolean
  defaultRole: string
  allowedDomains: string | null
}

/**
 * Charge la config OIDC effective, ou null si le SSO ne doit pas être actif
 * (désactivé, protocole non-OIDC, config incomplète, ou issuer non sûr).
 * Best-effort : toute erreur (table absente) ⇒ null (login classique intact).
 */
export async function loadSsoOidcConfig(): Promise<SsoOidcConfig | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = await (prisma as any).sSOConfig.findUnique({ where: { id: 'global' } })
    if (!c || c.enabled !== true || c.protocol !== 'OIDC') return null
    const issuer = (c.oidcIssuerUrl ?? '').trim().replace(/\/$/, '')
    const clientId = (c.oidcClientId ?? '').trim()
    const clientSecret = (decryptSecret(c.oidcClientSecret) ?? '').trim()
    if (!issuer || !clientId || !clientSecret) return null
    if (!isSafeIssuerUrl(issuer)) return null
    return {
      issuer, clientId, clientSecret,
      scopes: (c.oidcScopes ?? 'openid email profile').trim() || 'openid email profile',
      autoProvision: c.autoProvision !== false,
      defaultRole: c.defaultRole ?? 'ANALYSTE',
      allowedDomains: c.allowedDomains ?? null,
    }
  } catch {
    return null
  }
}

/** True si un SSO OIDC est actif (pour afficher le bouton de connexion). */
export async function ssoEnabled(): Promise<boolean> {
  return (await loadSsoOidcConfig()) !== null
}

/** Construit le provider OIDC NextAuth à partir de la config chargée. */
export function buildSsoProvider(cfg: SsoOidcConfig): OAuthConfig<Record<string, unknown>> {
  const provider = {
    id: SSO_PROVIDER_ID,
    name: 'SSO',
    type: 'oauth',
    // Découverte OIDC : NextAuth lit {issuer}/.well-known/openid-configuration.
    wellKnown: `${cfg.issuer}/.well-known/openid-configuration`,
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    authorization: { params: { scope: cfg.scopes } },
    idToken: true,
    checks: ['pkce', 'state'] as const,
    // Lie une identité OIDC à un compte existant de MÊME e-mail (cas JIT « link »).
    // Le risque « dangerous » est borné par l'allowlist de domaines + email_verified.
    allowDangerousEmailAccountLinking: true,
    // Le rôle par défaut est persisté dès la création (évite un décalage de session).
    profile(profile: Record<string, unknown>) {
      return {
        id: String(profile.sub ?? ''),
        email: typeof profile.email === 'string' ? profile.email : '',
        name: typeof profile.name === 'string' ? profile.name : null,
        role: cfg.defaultRole,
      }
    },
  }
  return provider as unknown as OAuthConfig<Record<string, unknown>>
}

/**
 * Décision d'admission SSO (gate du callback signIn). Applique l'allowlist de
 * domaines, la vérification d'e-mail et la règle d'auto-provisioning selon
 * l'existence d'un utilisateur. Renvoie true, ou un code de refus (i18n).
 */
export async function ssoSignInDecision(claims: OidcClaims): Promise<{ ok: true } | { ok: false; reason: string }> {
  const cfg = await loadSsoOidcConfig()
  if (!cfg) return { ok: false, reason: 'sso_desactive' }
  const email = typeof claims.email === 'string' ? claims.email.toLowerCase().trim() : ''
  let userExists = false
  if (email) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = await (prisma.user as any).findUnique({ where: { email }, select: { id: true } }).catch(() => null)
    userExists = !!u
  }
  const decision = resolveJitProvisioning(
    { autoProvision: cfg.autoProvision, defaultRole: cfg.defaultRole, allowedDomains: cfg.allowedDomains },
    claims,
    userExists,
  )
  if (decision.action === 'deny') {
    await auditLog('LOGIN_FAILED', { userEmail: email || undefined, details: { reason: `sso_${decision.reason}` } })
    return { ok: false, reason: decision.reason }
  }
  return { ok: true }
}

/**
 * Finalise un utilisateur provisionné par SSO (événement createUser NextAuth) :
 * force le rôle par défaut de la config et marque l'e-mail vérifié. No-op si le
 * SSO est désactivé (donc aucun effet sur les autres créations d'utilisateurs).
 */
export async function finalizeSsoProvisionedUser(userId: string): Promise<void> {
  const cfg = await loadSsoOidcConfig()
  if (!cfg) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.user as any).update({
    where: { id: userId },
    data: { role: cfg.defaultRole, emailVerified: new Date() },
  }).catch(() => { /* best-effort */ })
  await auditLog('LOGIN_SUCCESS', { userId, details: { via: 'sso', provisioned: true } })
}
