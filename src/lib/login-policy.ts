// ─── Résolution de la politique de connexion (PUR) ───────────────────────────
// Décide la politique effective (verrouillage + expiration + MFA) à partir de la
// ligne `passwordPolicy` lue en base — SANS toucher la base ici (testable). Le
// point clé de sécurité (O01, contre-audit 2026-09-21) : distinguer une politique
// ABSENTE (aucune ligne → posture neutre, installation vierge) d'une ERREUR DE
// LECTURE (on ne peut prouver l'absence d'exigence MFA → fail-closed : MFA imposée).

import { type MfaPolicyView } from '@/lib/mfa'
import { type LockoutPolicy } from '@/lib/login-lockout'

/** Politique de connexion effective : verrouillage + âge max du mot de passe + MFA. */
export interface LoginPolicy extends LockoutPolicy {
  maxAgeDays: number
  mfa: MfaPolicyView
}

/** MFA neutre (désactivée) — aucune politique configurée. */
export const MFA_DISABLED: MfaPolicyView = {
  mfaEnabled: false, mfaPendingConfirmation: false, mfaScope: 'ALL',
  mfaMethodEmail: true, mfaMethodSms: false, trustedDeviceEnabled: false,
}

/** MFA fail-closed (imposée) — politique illisible : on refuse de dégrader la posture. */
export const MFA_FAILCLOSED: MfaPolicyView = {
  mfaEnabled: true, mfaPendingConfirmation: false, mfaScope: 'ALL',
  mfaMethodEmail: true, mfaMethodSms: false, trustedDeviceEnabled: false,
}

const NEUTRAL_LOCKOUT = { maxFailedAttempts: 0, lockoutDurationMinutes: 15, maxAgeDays: 0 } as const

/**
 * Résout la politique effective. `readError=true` (la lecture a échoué) →
 * fail-closed (MFA imposée). `stored=null` sans erreur → neutre. Sinon, projette
 * la ligne stockée (valeurs par défaut sûres pour chaque champ absent).
 */
export function resolveLoginPolicy(stored: Record<string, unknown> | null, readError: boolean): LoginPolicy {
  if (readError) return { ...NEUTRAL_LOCKOUT, mfa: MFA_FAILCLOSED }
  if (!stored) return { ...NEUTRAL_LOCKOUT, mfa: MFA_DISABLED }
  return {
    maxFailedAttempts:      (stored.maxFailedAttempts as number) ?? 0,
    lockoutDurationMinutes: (stored.lockoutDurationMinutes as number) ?? 15,
    maxAgeDays:             (stored.maxAgeDays as number) ?? 0,
    mfa: {
      mfaEnabled:             stored.mfaEnabled === true,
      mfaPendingConfirmation: stored.mfaPendingConfirmation === true,
      mfaScope:               (stored.mfaScope as string) ?? 'ALL',
      mfaMethodEmail:         stored.mfaMethodEmail !== false,
      mfaMethodSms:           stored.mfaMethodSms === true,
      trustedDeviceEnabled:    stored.trustedDeviceEnabled === true,
    },
  }
}
