/**
 * mesure-categorie.ts — Catégorie EBIOS des mesures de sécurité.
 *
 * Exigence EXI_M5_06 du cahier des charges du label EBIOS Risk Manager (ANSSI v3.1) :
 * « L'application permet d'associer à chaque mesure de sécurité une catégorie
 * (gouvernance, protection, défense, résilience — cf. fiche méthode n°9). »
 *
 * Distinct du `type` de mesure (préventive/détective/… — TypeMesure Prisma) : la
 * catégorie EBIOS structure le plan de traitement du risque selon les 4 volets.
 * Porté par `Mesure.categorieEbios`.
 *
 * Module pur → testé unitairement (mesure-categorie.test.ts).
 */

export const CATEGORIES_MESURE_EBIOS = [
  'GOUVERNANCE',
  'PROTECTION',
  'DEFENSE',
  'RESILIENCE',
] as const

export type CategorieMesureEbios = typeof CATEGORIES_MESURE_EBIOS[number]

/** Catégorie par défaut d'une mesure. */
export const DEFAULT_CATEGORIE_MESURE: CategorieMesureEbios = 'PROTECTION'

/** Normalise une valeur arbitraire vers une catégorie connue ; défaut « protection ». */
export function normalizeCategorieMesure(v: unknown): CategorieMesureEbios {
  const value = String(v ?? '').toUpperCase()
  return (CATEGORIES_MESURE_EBIOS as readonly string[]).includes(value)
    ? (value as CategorieMesureEbios)
    : DEFAULT_CATEGORIE_MESURE
}
