/**
 * socle-etat.ts — État d'application des référentiels du socle de sécurité.
 *
 * Exigence EXI_M1_20 du cahier des charges du label EBIOS Risk Manager (ANSSI v3.1) :
 * « Un indicateur permet à l'utilisateur de visualiser rapidement l'état
 * d'application des référentiels listés (vert = appliqué sans restriction,
 * orange = appliqué avec restrictions, rouge = non appliqué). »
 *
 * Porté par chaque entrée de `Cadrage.referentiels` (champ `etatApplication`).
 * Stocké en JSON → pas de migration.
 *
 * Module pur → testé unitairement (socle-etat.test.ts).
 */

export const ETATS_SOCLE = ['APPLIQUE', 'PARTIEL', 'NON_APPLIQUE'] as const
export type EtatSocle = typeof ETATS_SOCLE[number]

/** État par défaut d'un référentiel ajouté au socle. */
export const DEFAULT_ETAT_SOCLE: EtatSocle = 'APPLIQUE'

/** Normalise une valeur arbitraire vers un état connu ; défaut « appliqué ». */
export function normalizeEtatSocle(v: unknown): EtatSocle {
  const value = String(v ?? '').toUpperCase()
  return (ETATS_SOCLE as readonly string[]).includes(value)
    ? (value as EtatSocle)
    : DEFAULT_ETAT_SOCLE
}

/**
 * Résout l'état d'application d'une entrée de référentiel, avec rétro-compatibilité
 * pour les analyses enregistrées avant l'ajout du champ `etatApplication` :
 *   - `etatApplication` explicite → prioritaire ;
 *   - sinon `applicable === false` → NON_APPLIQUE ;
 *   - sinon des écarts renseignés → PARTIEL (appliqué avec restrictions) ;
 *   - sinon → APPLIQUE.
 */
export function etatSocleFromEntry(entry: {
  etatApplication?: unknown
  applicable?: unknown
  ecarts?: unknown
  [key: string]: unknown
} | null | undefined): EtatSocle {
  if (!entry) return DEFAULT_ETAT_SOCLE
  if (entry.etatApplication != null && String(entry.etatApplication) !== '') {
    return normalizeEtatSocle(entry.etatApplication)
  }
  if (entry.applicable === false) return 'NON_APPLIQUE'
  if (typeof entry.ecarts === 'string' && entry.ecarts.trim() !== '') return 'PARTIEL'
  return 'APPLIQUE'
}
