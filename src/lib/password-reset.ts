import { createHash } from 'crypto'

export type PasswordResetMode = 'ADMIN' | 'EMAIL'

/** Reset links are single-use and valid for one hour. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000

/** Stores only a SHA-256 digest so a database disclosure cannot redeem a link. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function isResetTokenUsable(token: { expiresAt: Date; usedAt: Date | null }, now = new Date()): boolean {
  return token.usedAt === null && token.expiresAt.getTime() > now.getTime()
}

/** A public demo always enables the safe autonomous recovery route. */
export function resolvePasswordResetMode(configured: PasswordResetMode, isDemo: boolean): PasswordResetMode {
  return isDemo ? 'EMAIL' : configured
}
