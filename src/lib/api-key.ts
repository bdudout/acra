// ─── Clés d'API (accès machine à l'API publique v1) ──────────────────────────
// Format : « acra_<prefix>_<secret> ». Le préfixe (public, indexé) sert au
// lookup ; seul un dérivé scrypt SALÉ du jeton complet est stocké (« salt$hash »).
// Le jeton en clair n'est montré qu'une fois, à la création. Logique testée.

import { scrypt, randomBytes, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

export const API_KEY_PREFIX = 'acra'
export const API_SCOPES = ['read', 'write'] as const
export type ApiScope = (typeof API_SCOPES)[number]

const KEY_LEN = 32   // longueur du dérivé
const SALT_LEN = 16  // sel aléatoire par clé

/**
 * Dérive (scrypt, mémoire-dur) le jeton avec un sel aléatoire — ou le sel fourni
 * (vérification). Retourne « <saltHex>$<hashHex> ». Asynchrone (hors event loop).
 */
export async function hashApiKey(plaintext: string, saltHex?: string): Promise<string> {
  const salt = saltHex ?? randomBytes(SALT_LEN).toString('hex')
  const derived = (await scryptAsync(plaintext, salt, KEY_LEN)) as Buffer
  return `${salt}$${derived.toString('hex')}`
}

/** Vérifie un jeton contre un dérivé stocké « salt$hash » (comparaison à temps constant). */
export async function verifyApiKey(plaintext: string, stored: string): Promise<boolean> {
  const [salt, hex] = (stored ?? '').split('$')
  if (!salt || !hex) return false
  const cand = (await scryptAsync(plaintext, salt, KEY_LEN)) as Buffer
  const ref = Buffer.from(hex, 'hex')
  if (cand.length === 0 || cand.length !== ref.length) return false
  return timingSafeEqual(cand, ref)
}

export interface GeneratedApiKey {
  plaintext: string   // à montrer UNE fois au créateur
  prefix: string      // segment public, stocké en clair pour le lookup
}

/** Génère une clé d'API : préfixe public + secret aléatoire (≈180 bits d'entropie). */
export function generateApiKey(rnd: (n: number) => Buffer = randomBytes): GeneratedApiKey {
  const prefix = rnd(6).toString('hex')            // 12 hex — identifiant public
  const randomPart = rnd(24).toString('base64url') // secret
  return { plaintext: `${API_KEY_PREFIX}_${prefix}_${randomPart}`, prefix }
}

/** Extrait le préfixe et le jeton d'un en-tête « Authorization: Bearer acra_… ». */
export function parseAuthorizationHeader(header?: string | null): { prefix: string; plaintext: string } | null {
  if (!header || typeof header !== 'string') return null
  const m = header.match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  const token = m[1].trim()
  const parts = token.split('_')
  if (parts.length < 3 || parts[0] !== API_KEY_PREFIX || !parts[1]) return null
  return { prefix: parts[1], plaintext: token }
}

/** Représentation masquée pour l'affichage (jamais le secret). */
export function maskApiKey(prefix: string): string {
  return `${API_KEY_PREFIX}_${prefix}_${'•'.repeat(8)}`
}

/** Nettoie/valide une liste de scopes demandés ; défaut = ['read']. */
export function cleanScopes(v: unknown): ApiScope[] {
  if (!Array.isArray(v)) return ['read']
  const out = API_SCOPES.filter(s => v.includes(s))
  return out.length ? out : ['read']
}

export function hasScope(scopes: string[] | null | undefined, needed: ApiScope): boolean {
  return Array.isArray(scopes) && scopes.includes(needed)
}

/** Une clé est utilisable si elle n'est ni révoquée ni expirée. */
export function apiKeyUtilisable(
  k: { revokedAt?: Date | string | null; expiresAt?: Date | string | null },
  now: Date = new Date(),
): boolean {
  if (k.revokedAt) return false
  if (k.expiresAt) {
    const e = new Date(k.expiresAt)
    if (!Number.isNaN(e.getTime()) && e.getTime() <= now.getTime()) return false
  }
  return true
}
