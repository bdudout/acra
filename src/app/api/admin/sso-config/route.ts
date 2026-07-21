/**
 * GET  /api/admin/sso-config  — Lire la configuration SSO
 * PUT  /api/admin/sso-config  — Mettre à jour la configuration SSO
 *
 * Accessible aux ADMIN uniquement.
 * La connexion SSO sera disponible dans une version future.
 * Cette API ne modifie pas le flux d'authentification actuel.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { auditLog, getClientIp } from '@/lib/logger'
import { encryptSecret, decryptSecret } from '@/lib/secret-crypto'

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
  defaultRole:    z.enum(['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN', 'DIRECTION_METIER']).default('ANALYSTE'),
  allowedDomains: z.string().max(4096).nullable().optional(),
})

async function requireAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }), session: null }
  }
  // Configuration SSO/OIDC = réglage d'INSTANCE → SUPER_ADMIN uniquement.
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return { error: NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 }), session: null }
  }
  return { error: null, session }
}

/** Valeurs par défaut pour la création initiale */
const SSO_DEFAULTS = {
  id: 'global',
  enabled: false,
  protocol: 'OIDC',
  samlEntityId: null, samlSsoUrl: null, samlCertificate: null, samlSignAlgorithm: 'RSA-SHA256',
  oidcIssuerUrl: null, oidcClientId: null, oidcClientSecret: null, oidcScopes: 'openid email profile',
  autoProvision: true, defaultRole: 'ANALYSTE', allowedDomains: null,
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req)
  if (error) return error

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = await (prisma as any).sSOConfig.upsert({
    where:  { id: 'global' },
    create: SSO_DEFAULTS,
    update: {},
  })
  // [F005] Déchiffrement à la lecture pour l'UI admin (secret stocké chiffré au repos)
  return NextResponse.json({ ...config, oidcClientSecret: decryptSecret(config.oidcClientSecret) })
}

export async function PUT(req: NextRequest) {
  const { error, session } = await requireAdmin(req)
  if (error) return error

  const userId   = (session!.user as any).id
  const userRole = (session!.user as any).role ?? 'ADMIN'

  const body = await req.json()
  const parsed = SSOSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  }

  // Ne pas journaliser les secrets dans l'audit trail
  const auditData = { ...parsed.data, oidcClientSecret: parsed.data.oidcClientSecret ? '[REDACTED]' : null }

  // [F005 corrigé] Chiffrement au repos du Client Secret OIDC (AES-256-GCM) avant persistance.
  const toStore = { ...parsed.data, oidcClientSecret: encryptSecret(parsed.data.oidcClientSecret) }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = await (prisma as any).sSOConfig.upsert({
    where:  { id: 'global' },
    create: { id: 'global', ...toStore },
    update: toStore,
  })

  await auditLog('SSO_CONFIG_UPDATED', { userId, userRole, ip: getClientIp(req), details: auditData })
  // Renvoie la valeur en clair à l'UI (le stockage reste chiffré)
  return NextResponse.json({ ...config, oidcClientSecret: decryptSecret(config.oidcClientSecret) })
}
