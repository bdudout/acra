// ─── Résolution d'une clé d'API présentée (API v1, SCIM, MCP) ────────────────
// Point commun aux trois surfaces machine. Audit 2026-09-30 (N04 / CWE-307, 208) :
//  - limitation de débit PAR IP AVANT toute dérivation scrypt (anti-amplification
//    de DoS : une requête à préfixe connu coûtait un scrypt, sans frein) ;
//  - dérivation factice quand le préfixe est inconnu, pour égaliser le temps de
//    réponse (un préfixe inexistant ne se distingue plus d'un secret erroné).

import { prisma } from '@/lib/prisma'
import { hashApiKey, verifyApiKey } from '@/lib/api-key'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/logger'

/** Plafond de tentatives d'authentification par IP (les clients machine légitimes restent très en deçà). */
export const LIMIT_API_KEY_AUTH = { limit: 300, windowMs: 60_000 } as const

let dummyHash: Promise<string> | null = null

export type ApiKeyLookup =
  | { status: 'ok'; key: NonNullable<Awaited<ReturnType<typeof prisma.apiKey.findUnique>>> }
  | { status: 'invalid' }
  | { status: 'throttled' }

export async function lookupApiKey(req: Request, parsed: { prefix: string; plaintext: string }): Promise<ApiKeyLookup> {
  const ip = getClientIp(req as unknown as { headers: { get: (k: string) => string | null } })
  const rl = await rateLimit(`apikey-auth:${ip}`, LIMIT_API_KEY_AUTH.limit, LIMIT_API_KEY_AUTH.windowMs)
  if (!rl.allowed) return { status: 'throttled' }
  const key = await prisma.apiKey.findUnique({ where: { prefix: parsed.prefix } })
  if (!key) {
    dummyHash ??= hashApiKey('acra-dummy-key')
    await verifyApiKey(parsed.plaintext, await dummyHash)
    return { status: 'invalid' }
  }
  return (await verifyApiKey(parsed.plaintext, key.hashedKey)) ? { status: 'ok', key } : { status: 'invalid' }
}
