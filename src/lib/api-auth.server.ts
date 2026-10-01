// ─── Authentification de l'API publique v1 (clé d'API Bearer) ────────────────
// Résout une requête machine en { organizationId, scopes } à partir de l'en-tête
// Authorization. Point UNIQUE d'authentification des routes /api/v1/*.

import { prisma } from '@/lib/prisma'
import { lookupApiKey } from '@/lib/api-key-lookup.server'
import { parseAuthorizationHeader, apiKeyUtilisable, hasScope, type ApiScope } from '@/lib/api-key'
import { isApiEnabled } from '@/lib/interfaces-config.server'

/** Résultat d'authentification d'une clé d'API : succès (org + scopes + keyId) ou échec (status + message). */
export type ApiAuth =
  | { ok: true; organizationId: string; scopes: string[]; keyId: string; actorUserId: string | null }
  | { ok: false; status: number; error: string }

/**
 * Authentifie une requête d'API v1. `needed` = scope minimal requis (read/write).
 * Ne divulgue jamais si le préfixe existe (401 générique) ; distingue seulement
 * le scope insuffisant (403).
 */
export async function authenticateApiRequest(req: Request, needed: ApiScope = 'read'): Promise<ApiAuth> {
  // Interrupteur d'instance (SUPER_ADMIN) : l'API v1 est DÉSACTIVÉE par défaut.
  // Refus AVANT tout traitement de la clé (aucune divulgation, aucune écriture).
  if (!(await isApiEnabled())) return { ok: false, status: 503, error: 'api_disabled' }

  const parsed = parseAuthorizationHeader(req.headers.get('authorization'))
  if (!parsed) return { ok: false, status: 401, error: 'missing_or_invalid_authorization' }

  // Débit par IP avant scrypt + temps égalisé si le préfixe est inconnu (N04).
  const found = await lookupApiKey(req, parsed)
  if (found.status === 'throttled') return { ok: false, status: 429, error: 'rate_limited' }
  if (found.status !== 'ok') return { ok: false, status: 401, error: 'invalid_api_key' }
  const key = found.key
  if (!apiKeyUtilisable(key)) return { ok: false, status: 401, error: 'api_key_revoked_or_expired' }

  const scopes = Array.isArray(key.scopes) ? (key.scopes as string[]) : ['read']
  if (!hasScope(scopes, needed)) return { ok: false, status: 403, error: 'insufficient_scope' }

  // Trace d'utilisation (best-effort, hors chemin critique).
  prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {})

  // L'auteur technique est conservé pour les routes qui créent des objets reliés
  // à User. Une ancienne clé sans créateur est explicitement refusée par ces routes.
  return { ok: true, organizationId: key.organizationId, scopes, keyId: key.id, actorUserId: key.createdBy ?? null }
}
