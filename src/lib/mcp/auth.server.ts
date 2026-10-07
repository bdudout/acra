// ─── Authentification MCP (clé d'API Bearer + scope `mcp`) ────────────────────
// Point UNIQUE d'authentification de l'endpoint MCP (`/api/mcp`). Distinct de
// `authenticateApiRequest` (API v1) sur deux points : (1) garde sur l'interrupteur
// d'instance `mcpEnabled` (et non `apiEnabled`) ; (2) scope requis = `mcp` (moindre
// privilège — un scope `read`/`write` v1 n'ouvre PAS la surface MCP, cf.
// docs/mcp-cadrage.md §3.5). Réutilise l'infra de clés existante (préfixe indexé,
// dérivé scrypt salé, révocation/expiration, `lastUsedAt`).

import { prisma } from '@/lib/prisma'
import { lookupApiKey } from '@/lib/api-key-lookup.server'
import { parseAuthorizationHeader, apiKeyUtilisable, hasScope } from '@/lib/api-key'
import { isMcpEnabled } from '@/lib/interfaces-config.server'
import { getOrgConfig } from '@/lib/org-config.server'

/** Résultat d'authentification MCP : succès (org + clé) ou échec (status + message). */
export type McpAuth =
  | { ok: true; organizationId: string; keyId: string; scopes: string[] }
  | { ok: false; status: number; error: string }

/**
 * Authentifie une requête MCP. Refuse AVANT tout traitement si MCP est désactivé
 * (503, aucune divulgation). Puis clé d'API valide (401 générique) + scope `mcp`
 * (403). Ne divulgue jamais l'existence d'un préfixe.
 */
export async function authenticateMcpRequest(req: Request): Promise<McpAuth> {
  if (!(await isMcpEnabled())) return { ok: false, status: 503, error: 'mcp_disabled' }

  const parsed = parseAuthorizationHeader(req.headers.get('authorization'))
  if (!parsed) return { ok: false, status: 401, error: 'missing_or_invalid_authorization' }

  // Débit par IP avant scrypt + temps égalisé si le préfixe est inconnu (N04).
  const found = await lookupApiKey(req, parsed)
  if (found.status === 'throttled') return { ok: false, status: 429, error: 'rate_limited' }
  if (found.status !== 'ok') return { ok: false, status: 401, error: 'invalid_api_key' }
  const key = found.key
  if (!apiKeyUtilisable(key)) return { ok: false, status: 401, error: 'api_key_revoked_or_expired' }

  const scopes = Array.isArray(key.scopes) ? (key.scopes as string[]) : []
  if (!hasScope(scopes, 'mcp')) return { ok: false, status: 403, error: 'insufficient_scope' }

  // Interrupteur PAR ORGANISATION (ADMIN de l'organisation, défaut désactivé) en plus de l'interrupteur d'instance.
  if (!(await getOrgConfig(key.organizationId)).mcpActive) return { ok: false, status: 403, error: 'mcp_org_disabled' }

  prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
  return { ok: true, organizationId: key.organizationId, keyId: key.id, scopes }
}
