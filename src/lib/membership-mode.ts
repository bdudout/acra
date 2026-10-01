// ─── Rattachement d'un compte existant à une organisation (T23) — PUR ────────
// Le bon comportement dépend du MODE DE DÉPLOIEMENT :
//  - instance sur site : l'employeur décide → ajout DIRECT (avec e-mail d'information) ;
//  - instance ouverte (SaaS, communautaire, démo) : la personne doit consentir →
//    INVITATION à accepter, et réponse identique que l'e-mail ait un compte ou non
//    (pas d'énumération des inscrits).
// AUTO (défaut) déduit le mode de l'ouverture de l'instance ; le SUPER_ADMIN peut forcer.

import { createHash, randomBytes } from 'crypto'

export const MEMBERSHIP_MODES = ['AUTO', 'DIRECT', 'INVITATION'] as const
export type MembershipModeSetting = (typeof MEMBERSHIP_MODES)[number]
export type MembershipMode = Exclude<MembershipModeSetting, 'AUTO'>

/** Durée de validité d'une invitation. */
export const INVITATION_TTL_DAYS = 7

/** Réglage assaini (valeur inconnue → AUTO). */
export function cleanMembershipMode(v: unknown): MembershipModeSetting {
  return typeof v === 'string' && (MEMBERSHIP_MODES as readonly string[]).includes(v) ? v as MembershipModeSetting : 'AUTO'
}

/** Mode effectif : réglage forcé, sinon INVITATION si l'instance est ouverte (démo ou inscription publique). */
export function resolveMembershipMode(setting: unknown, instanceOpen: boolean): MembershipMode {
  const s = cleanMembershipMode(setting)
  if (s !== 'AUTO') return s
  return instanceOpen ? 'INVITATION' : 'DIRECT'
}

/** Nouveau jeton d'invitation : la valeur claire part dans l'e-mail, seul le hachage est stocké. */
export function newInvitationToken(rnd: (n: number) => Buffer = randomBytes): { token: string; tokenHash: string } {
  const token = rnd(32).toString('base64url')
  return { token, tokenHash: hashInvitationToken(token) }
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export type InvitationState = 'VALID' | 'EXPIRED' | 'USED'

/** État d'une invitation (usage unique, expiration). */
export function invitationState(inv: { expiresAt: Date | string; acceptedAt?: Date | string | null }, now: Date = new Date()): InvitationState {
  if (inv.acceptedAt) return 'USED'
  return new Date(inv.expiresAt).getTime() <= now.getTime() ? 'EXPIRED' : 'VALID'
}

/** L'invitation est destinée à CET e-mail (comparaison insensible à la casse et aux espaces). */
export function invitationMatchesEmail(invitationEmail: string, userEmail: string | null | undefined): boolean {
  return !!userEmail && invitationEmail.trim().toLowerCase() === userEmail.trim().toLowerCase()
}
