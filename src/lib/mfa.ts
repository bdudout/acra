/**
 * mfa.ts — Primitives MFA (OTP à usage unique) : génération, hachage et
 * vérification de codes, indépendantes de la base et de tout I/O.
 *
 * Le code n'est jamais stocké en clair : on persiste un HMAC-SHA256 (clé =
 * secret serveur). La vérification est à temps constant. Le contrôle
 * d'expiration et du nombre de tentatives est porté par le modèle MfaChallenge
 * (TTL court + max tentatives) côté appelant.
 */
import { createHmac, randomInt, timingSafeEqual } from 'crypto'

export const MFA_CODE_DIGITS = 6
export const MFA_TTL_MS = 5 * 60 * 1000 // 5 minutes
export const MFA_MAX_ATTEMPTS = 5

/** Génère un code numérique cryptographiquement aléatoire, zéro-paddé. */
export function generateCode(digits = MFA_CODE_DIGITS): string {
  const max = 10 ** digits
  return String(randomInt(0, max)).padStart(digits, '0')
}

/** HMAC-SHA256 du code (clé = secret serveur). Déterministe. */
export function hashCode(code: string, secret: string): string {
  return createHmac('sha256', secret).update(code).digest('hex')
}

/** Comparaison à temps constant de deux hex de même longueur. */
function safeEqualHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

/** Vérifie un code en clair contre son hash stocké (temps constant). */
export function verifyCode(code: string, codeHash: string, secret: string): boolean {
  if (!code || !codeHash) return false
  return safeEqualHex(hashCode(code, secret), codeHash)
}

/** Le challenge est-il expiré ? `expiresAt` peut être une Date ou un timestamp ms. */
export function isExpired(expiresAt: Date | number, now: number = Date.now()): boolean {
  const ts = expiresAt instanceof Date ? expiresAt.getTime() : expiresAt
  return now >= ts
}

export interface MfaPolicyView {
  mfaEnabled: boolean
  mfaPendingConfirmation: boolean
  mfaScope: string // 'ALL' | 'ADMIN_ONLY'
  mfaMethodEmail: boolean
  mfaMethodSms: boolean
}

export type MfaChannel = 'EMAIL' | 'SMS'

/** Le MFA doit-il être exigé à la connexion pour ce rôle ? (logique pure) */
export function isMfaRequired(p: MfaPolicyView, role: string): boolean {
  if (!p.mfaEnabled || p.mfaPendingConfirmation) return false
  return p.mfaScope === 'ALL' || role === 'ADMIN'
}

/**
 * Détermine le canal d'envoi du code, en tenant compte des méthodes activées,
 * de la présence d'un téléphone et d'un éventuel canal demandé. `null` si aucun
 * canal exploitable (ex. SMS seul mais pas de téléphone).
 */
export function resolveChannel(
  p: MfaPolicyView,
  hasPhone: boolean,
  requested?: string | null,
): MfaChannel | null {
  if (requested === 'SMS' && p.mfaMethodSms && hasPhone) return 'SMS'
  if (requested === 'EMAIL' && p.mfaMethodEmail) return 'EMAIL'
  // Défaut : e-mail si disponible, sinon SMS si un téléphone est renseigné.
  if (p.mfaMethodEmail) return 'EMAIL'
  if (p.mfaMethodSms && hasPhone) return 'SMS'
  return null
}
