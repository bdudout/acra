/**
 * GET  /api/admin/sso-config  — Lire la configuration SSO
 * PUT  /api/admin/sso-config  — Mettre à jour la configuration SSO
 *
 * Accessible aux ADMIN uniquement.
 * La connexion SSO sera disponible dans une version future.
 * Cette API ne modifie pas le flux d'authentification actuel.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { auditLog, getClientIp } from '@/lib/logger'
import { maskSecret, resolveSubmittedSecret, SECRET_PLACEHOLDER } from '@/lib/secret-crypto'
import { cleanRoleMapping } from '@/lib/sso'
import { ROLES_ATTRIBUABLES } from '@/lib/permissions'
import { requireInstanceAdmin } from '@/lib/route-guard.server'

// [F005 corrigé] CWE-312 / OWASP A02:2021 — Secrets chiffrés au repos
// oidcClientSecret est désormais chiffré (AES-256-GCM, src/lib/secret-crypto.ts) avant
// persistance et déchiffré uniquement pour l'UI admin. L'audit trail le redacte déjà.
// Clé via SECRETS_ENCRYPTION_KEY (ou repli NEXTAUTH_SECRET). samlCertificate = certificat
// X.509 PUBLIC de l'IdP → non chiffré (non secret). Secrets SMS : voir password-policy.
// REF: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
const SSOSchema = z.object({
  enabled:  z.boolean().default(false),
  protocol: z.enum(['SAML', 'OIDC']).default('OIDC'),

  // SAML
  samlEntityId:      z.string().max(512).nullable().optional(),
  samlSsoUrl:        z.string().url().max(1024).nullable().optional(),
  samlCertificate:   z.string().max(8192).nullable().optional(),
  samlSignAlgorithm: z.enum(['RSA-SHA256', 'RSA-SHA1']).default('RSA-SHA256'),

  // OIDC
  oidcIssuerUrl:    z.string().url().max(1024).nullable().optional(),
  oidcClientId:     z.string().max(512).nullable().optional(),
  oidcClientSecret: z.string().max(512).nullable().optional(),
  oidcScopes:       z.string().max(256).default('openid email profile'),

  // Common
  autoProvision:  z.boolean().default(true),
  defaultRole:    z.enum(ROLES_ATTRIBUABLES).default('ANALYSTE'),
  allowedDomains: z.string().max(4096).nullable().optional(),

  // RBAC piloté par l'IdP : claim de groupes + mapping groupe→rôle
  oidcGroupsClaim: z.string().max(128).nullable().optional(),
  roleMapping:     z.union([z.string().max(8192), z.record(z.string())]).nullable().optional(),
})


/** Valeurs par défaut pour la création initiale */
const SSO_DEFAULTS = {
  id: 'global',
  enabled: false,
  protocol: 'OIDC',
  samlEntityId: null, samlSsoUrl: null, samlCertificate: null, samlSignAlgorithm: 'RSA-SHA256',
  oidcIssuerUrl: null, oidcClientId: null, oidcClientSecret: null, oidcScopes: 'openid email profile',
  autoProvision: true, defaultRole: 'ANALYSTE', allowedDomains: null,
  oidcGroupsClaim: 'groups', roleMapping: {},
}

// GET /api/admin/sso-config — lit la configuration SSO d'entreprise (OIDC/SAML) de l'instance (SUPER_ADMIN).
export async function GET(req: NextRequest) {
  const { error } = await requireInstanceAdmin(req)
  if (error) return error

  const config = await prisma.sSOConfig.upsert({
    where:  { id: 'global' },
    create: SSO_DEFAULTS,
    update: {},
  })
  // [F005] Déchiffrement à la lecture pour l'UI admin (secret stocké chiffré au repos)
  return NextResponse.json({ ...config, oidcClientSecret: maskSecret(config.oidcClientSecret) })
}

// PUT /api/admin/sso-config — met à jour la configuration SSO (fournisseur, endpoints, secrets) — SUPER_ADMIN.
export async function PUT(req: NextRequest) {
  const { error, session } = await requireInstanceAdmin(req)
  if (error) return error

  const userId   = (session!.user as any).id
  const userRole = (session!.user as any).role ?? 'ADMIN'

  const body = await req.json()
  const parsed = SSOSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  }

  // Ne pas journaliser les secrets dans l'audit trail
  const auditData = { ...parsed.data, oidcClientSecret: parsed.data.oidcClientSecret && parsed.data.oidcClientSecret !== SECRET_PLACEHOLDER ? '[REDACTED]' : undefined }

  // [F005 corrigé] Chiffrement au repos du Client Secret OIDC (AES-256-GCM) avant persistance.
  // roleMapping nettoyé (rôles assignables uniquement) ; claim de groupes normalisé.
  const current = await prisma.sSOConfig.findUnique({ where: { id: 'global' }, select: { oidcClientSecret: true } })
  const toStore = {
    ...parsed.data,
    oidcClientSecret: resolveSubmittedSecret(parsed.data.oidcClientSecret, current?.oidcClientSecret),
    oidcGroupsClaim: (parsed.data.oidcGroupsClaim ?? 'groups') || 'groups',
    roleMapping: cleanRoleMapping(parsed.data.roleMapping),
  }

  const config = await prisma.sSOConfig.upsert({
    where:  { id: 'global' },
    create: { id: 'global', ...toStore },
    update: toStore,
  })

  await auditLog('SSO_CONFIG_UPDATED', { userId, userRole, ip: getClientIp(req), details: auditData })
  // Renvoie la valeur en clair à l'UI (le stockage reste chiffré)
  return NextResponse.json({ ...config, oidcClientSecret: maskSecret(config.oidcClientSecret) })
}
