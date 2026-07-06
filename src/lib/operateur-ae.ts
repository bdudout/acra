/**
 * operateur-ae.ts — Opérateurs logiques ET/OU entre actions élémentaires.
 *
 * Exigence EXI_M4_06 du cahier des charges du label EBIOS Risk Manager (ANSSI v3.1) :
 * dans un mode opératoire, on peut relier les actions élémentaires par un opérateur
 *   - ET : toutes les actions précédentes sont requises pour enchaîner la suivante ;
 *   - OU : une seule des actions précédentes suffit.
 *
 * Porté par chaque action élémentaire (champ `operateur`, dans le JSON
 * `ScenarioOperationnel.actionsElementaires`) → pas de migration.
 *
 * Module pur → testé unitairement (operateur-ae.test.ts).
 */

export const OPERATEURS_AE = ['ET', 'OU'] as const
export type OperateurAe = typeof OPERATEURS_AE[number]

/** Opérateur par défaut : ET (enchaînement conjonctif). */
export const DEFAULT_OPERATEUR: OperateurAe = 'ET'

/** Normalise une valeur arbitraire vers un opérateur connu ; défaut « ET ». */
export function normalizeOperateur(v: unknown): OperateurAe {
  const value = String(v ?? '').toUpperCase()
  return (OPERATEURS_AE as readonly string[]).includes(value)
    ? (value as OperateurAe)
    : DEFAULT_OPERATEUR
}
