// ─── Authentification de l'API publique v1 (clé d'API Bearer) ────────────────
// Résout une requête machine en { organizationId, scopes } à partir de l'en-tête
// Authorization. Point UNIQUE d'authentification des routes /api/v1/*.

import { prisma } from '@/lib/prisma'
import { parseAuthorizationHeader, verifyApiKey, apiKeyUtilisable, hasScope, type ApiScope } from '@/lib/api-key'

export type ApiAuth =
  | { ok: true; organizationId: string; scopes: string[]; keyId: string }
  | { ok: false; status: number; error: string }

/**
 * Authentifie une requête d'API v1. `needed` = scope minimal requis (read/write).
 * Ne divulgue jamais si le préfixe existe (401 générique) ; distingue seulement
 * le scope insuffisant (403).
 */
export async function authenticateApiRequest(req: Request, needed: ApiScope = 'read'): Promise<ApiAuth> {
  const parsed = parseAuthorizationHeader(req.headers.get('authorization'))
  if (!parsed) return { ok: false, status: 401, error: 'missing_or_invalid_authorization' }

  const key = await prisma.apiKey.findUnique({ where: { prefix: parsed.prefix } })
  // Vérification à temps constant du dérivé scrypt.
  if (!key || !(await verifyApiKey(parsed.plaintext, key.hashedKey))) {
    return { ok: false, status: 401, error: 'invalid_api_key' }
  }
  if (!apiKeyUtilisable(key)) return { ok: false, status: 401, error: 'api_key_revoked_or_expired' }

  const scopes = Array.isArray(key.scopes) ? (key.scopes as string[]) : ['read']
  if (!hasScope(scopes, needed)) return { ok: false, status: 403, error: 'insufficient_scope' }

  // Trace d'utilisation (best-effort, hors chemin critique).
  prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {})

  return { ok: true, organizationId: key.organizationId, scopes, keyId: key.id }
}
