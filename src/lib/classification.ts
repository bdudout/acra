/**
 * classification.ts — Niveau de classification de l'information (France, IGI-1300).
 *
 * Marqueur DOCUMENTAIRE porté par chaque valeur métier (stocké dans le JSON du
 * cadrage, pas de migration). N'altère pas la cotation DICT — il informe et
 * apparaît dans le rapport. Niveaux officiels actuels :
 *   NP  = Non protégé          DR = Diffusion Restreinte
 *   S   = Secret               TS = Très Secret
 *
 * Module pur → testé unitairement (classification.test.ts).
 */

export const CLASSIFICATIONS = ['NP', 'DR', 'S', 'TS'] as const
export type Classification = typeof CLASSIFICATIONS[number]

/** Normalise une valeur arbitraire vers un niveau connu ; défaut « NP » (non protégé). */
export function normalizeClassification(c: unknown): Classification {
  const v = String(c ?? '').toUpperCase()
  return (CLASSIFICATIONS as readonly string[]).includes(v) ? (v as Classification) : 'NP'
}

/** Vrai si l'information est protégée (DR, S ou TS), c.-à-d. au-delà de « Non protégé ». */
export function isClassified(c: unknown): boolean {
  return normalizeClassification(c) !== 'NP'
}
