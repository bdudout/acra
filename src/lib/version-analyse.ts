/**
 * version-analyse.ts — Gestion des versions x.y d'une analyse de risque.
 *
 * Exigence §3.4 du cahier des charges du label EBIOS Risk Manager (ANSSI v3.1) :
 * suivre les révisions successives d'une analyse en incrémentant la version x.y —
 * le « y » (mineur) pour une mise à jour opérationnelle, le « x » (majeur) pour
 * une mise à jour stratégique — et en conservant une synthèse des révisions.
 *
 * Module pur → testé unitairement (version-analyse.test.ts).
 */

export const CYCLES_REVISION = ['OPERATIONNEL', 'STRATEGIQUE'] as const
export type CycleRevision = typeof CYCLES_REVISION[number]

/** Cycle par défaut d'une révision. */
export const DEFAULT_CYCLE: CycleRevision = 'OPERATIONNEL'

/** Entier ≥ 0 à partir d'une valeur arbitraire (défaut 0). */
function toNonNegInt(v: unknown): number {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Formate une version en « x.y ». */
export function formatVersion(maj: number, min: number): string {
  return `${toNonNegInt(maj)}.${toNonNegInt(min)}`
}

/** Normalise une valeur arbitraire vers un cycle connu ; défaut « opérationnel ». */
export function normalizeCycle(v: unknown): CycleRevision {
  const value = String(v ?? '').toUpperCase()
  return (CYCLES_REVISION as readonly string[]).includes(value)
    ? (value as CycleRevision)
    : DEFAULT_CYCLE
}

/**
 * Calcule la version suivante selon le cycle de révision :
 *   - opérationnel → incrément du mineur (y) ;
 *   - stratégique  → incrément du majeur (x) et remise à zéro du mineur.
 */
export function nextVersion(maj: number, min: number, cycle: CycleRevision): { maj: number; min: number } {
  const M = toNonNegInt(maj)
  const m = toNonNegInt(min)
  return normalizeCycle(cycle) === 'STRATEGIQUE'
    ? { maj: M + 1, min: 0 }
    : { maj: M, min: m + 1 }
}
