/**
 * mention-protection.ts — Mention de protection de l'analyse de risque.
 *
 * Exigence §3.2 du cahier des charges du label EBIOS Risk Manager (ANSSI, v3.1) :
 * « L'application permet de porter une mention (obligatoire) de protection à
 * l'analyse de risque. Par exemple : non protégée, sensible, restreinte ou
 * confidentielle. »
 *
 * Marqueur porté par l'analyse ELLE-MÊME (colonne `mentionProtection`), distinct
 * de la classification par valeur métier (cf. [[classification.ts]], IGI-1300).
 * Il s'affiche sur la page de garde et le pied de page des exports.
 *
 * Module pur → testé unitairement (mention-protection.test.ts).
 */

export const MENTIONS_PROTECTION = [
  'NON_PROTEGEE',
  'SENSIBLE',
  'RESTREINTE',
  'CONFIDENTIELLE',
] as const

export type MentionProtection = typeof MENTIONS_PROTECTION[number]

/** Mention par défaut d'une nouvelle analyse. */
export const DEFAULT_MENTION_PROTECTION: MentionProtection = 'NON_PROTEGEE'

/** Normalise une valeur arbitraire vers une mention connue ; défaut « non protégée ». */
export function normalizeMentionProtection(v: unknown): MentionProtection {
  const value = String(v ?? '').toUpperCase()
  return (MENTIONS_PROTECTION as readonly string[]).includes(value)
    ? (value as MentionProtection)
    : DEFAULT_MENTION_PROTECTION
}

/** Vrai dès qu'une protection s'applique (toute mention autre que « non protégée »). */
export function isProtectedMention(v: unknown): boolean {
  return normalizeMentionProtection(v) !== 'NON_PROTEGEE'
}
