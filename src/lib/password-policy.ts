export interface PasswordPolicyShape {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumbers: boolean
  requireSpecial: boolean
  maxAgeDays: number
}

/**
 * Politique par défaut conforme au guide d'hygiène informatique ANSSI v2 (règle n°5).
 *
 * Recommandations appliquées :
 *  - Longueur minimale : 12 caractères (ANSSI recommande ≥ 12 pour comptes standard,
 *    ≥ 15 pour comptes privilégiés — configurable par l'admin)
 *  - Complexité : majuscule + minuscule + chiffre + caractère spécial
 *  - Renouvellement : 90 jours (ANSSI § 5.3 — "renouvelé périodiquement")
 *
 * Sources :
 *  - ANSSI — Guide d'hygiène informatique v2 (2017), mesure n°5
 *  - ANSSI — Recommandations relatives à l'authentification multifacteur (2021)
 */
export const DEFAULT_POLICY: PasswordPolicyShape = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecial: true,
  maxAgeDays: 90,
}

/**
 * Code d'une règle de mot de passe non satisfaite.
 * La traduction du libellé est faite côté UI (i18n), pas dans cette lib pure.
 */
export type PasswordRuleCode = 'minLength' | 'uppercase' | 'lowercase' | 'digit' | 'special'

/**
 * Valide un mot de passe contre la politique donnée.
 * Retourne les CODES des règles non satisfaites (tableau vide = valide).
 */
export function validatePassword(
  password: string,
  policy: PasswordPolicyShape
): PasswordRuleCode[] {
  const errors: PasswordRuleCode[] = []

  if (password.length < policy.minLength) errors.push('minLength')
  if (policy.requireUppercase && !/[A-Z]/.test(password)) errors.push('uppercase')
  if (policy.requireLowercase && !/[a-z]/.test(password)) errors.push('lowercase')
  if (policy.requireNumbers && !/[0-9]/.test(password)) errors.push('digit')
  if (policy.requireSpecial && !/[^A-Za-z0-9]/.test(password)) errors.push('special')

  return errors
}

// ── Génération de mot de passe conforme ───────────────────────────────────────

const POOL_LOWER   = 'abcdefghijkmnpqrstuvwxyz'   // sans l ambigu
const POOL_UPPER   = 'ABCDEFGHJKLMNPQRSTUVWXYZ'   // sans I/O ambigus
const POOL_NUMBER  = '23456789'                   // sans 0/1 ambigus
const POOL_SPECIAL = '!@#$%^&*-_=+?'

/** Entier aléatoire cryptographiquement sûr dans [0, max) (repli Math.random). */
function secureRandomInt(max: number): number {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto
  if (cryptoObj?.getRandomValues) {
    const arr = new Uint32Array(1)
    cryptoObj.getRandomValues(arr)
    return arr[0] % max
  }
  return Math.floor(Math.random() * max)
}

function pick(pool: string): string {
  return pool[secureRandomInt(pool.length)]
}

/**
 * Génère un mot de passe aléatoire respectant la politique fournie.
 * Garantit au moins un caractère de chaque classe requise, puis complète
 * jusqu'à la longueur minimale (au moins 14 caractères) et mélange le tout.
 */
export function generateCompliantPassword(policy: PasswordPolicyShape): string {
  const required: string[] = []
  let pool = ''

  if (policy.requireLowercase) { required.push(pick(POOL_LOWER));   pool += POOL_LOWER }
  if (policy.requireUppercase) { required.push(pick(POOL_UPPER));   pool += POOL_UPPER }
  if (policy.requireNumbers)   { required.push(pick(POOL_NUMBER));  pool += POOL_NUMBER }
  if (policy.requireSpecial)   { required.push(pick(POOL_SPECIAL)); pool += POOL_SPECIAL }
  // Si aucune classe n'est requise, utiliser lettres + chiffres par défaut
  if (!pool) pool = POOL_LOWER + POOL_UPPER + POOL_NUMBER

  const targetLength = Math.max(policy.minLength, 14, required.length)
  const chars = [...required]
  while (chars.length < targetLength) chars.push(pick(pool))

  // Mélange de Fisher–Yates
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/**
 * Returns true if the password has expired based on maxAgeDays.
 * If maxAgeDays = 0 or passwordChangedAt is null, never expires.
 */
export function isPasswordExpired(
  passwordChangedAt: Date | null | undefined,
  maxAgeDays: number
): boolean {
  if (!maxAgeDays || !passwordChangedAt) return false
  const expiresAt = new Date(passwordChangedAt)
  expiresAt.setDate(expiresAt.getDate() + maxAgeDays)
  return new Date() > expiresAt
}
