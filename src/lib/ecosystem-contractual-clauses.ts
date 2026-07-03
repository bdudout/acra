/**
 * ecosystem-contractual-clauses.ts — Clauses contractuelles par prestataire
 * (Atelier 3, écosystème — issue #2).
 *
 * Les exigences contractuelles imposées à un tiers (clauses RGPD, clauses de
 * sécurité, plan d'assurance sécurité, annexes PCI/PSEE, réversibilité, qualité
 * de service, SLA) sont représentées comme des MESURES d'écosystème de type
 * `CONTRACTUELLE`, TAGUÉES à la partie prenante concernée (champ `partiePrenante`).
 * Elles restent stockées en JSON sur le scénario stratégique (aucune migration),
 * mais peuvent être regroupées « par prestataire » à l'affichage.
 *
 * Module PUR → testé unitairement (ecosystem-contractual-clauses.test.ts).
 */

/** Valeur du champ `type` d'une mesure d'écosystème contractuelle. */
export const CONTRACTUELLE_TYPE = 'CONTRACTUELLE' as const

/** Clés stables des clauses contractuelles standard (ordre d'affichage). */
export const CONTRACTUAL_CLAUSE_KEYS = [
  'rgpd',
  'securite',
  'pas',
  'pciPsee',
  'reversibilite',
  'qos',
  'sla',
] as const

export type ContractualClauseKey = typeof CONTRACTUAL_CLAUSE_KEYS[number]

/** Vrai si la mesure est une clause contractuelle. */
export function isContractualMeasure(m: { type?: unknown } | null | undefined): boolean {
  return !!m && m.type === CONTRACTUELLE_TYPE
}

/**
 * Titre déterministe d'une mesure de clause contractuelle : `[<tag>] <label>` et,
 * si un prestataire est fourni, suffixé « — <prestataire> ». Déterministe car il
 * sert de clé de déduplication (une même clause n'est ajoutée qu'une fois par PP).
 */
export function contractualClauseTitle(tag: string, label: string, ppNom?: string): string {
  const base = `[${tag}] ${label}`
  const pp = (ppNom ?? '').trim()
  return pp ? `${base} — ${pp}` : base
}

/** Squelette de mesure d'écosystème pour une clause contractuelle. */
export function contractualClauseMeasure(
  tag: string,
  label: string,
  ppNom?: string,
  description?: string,
): {
  partiePrenante: string
  mesure: string
  description: string
  priorite: 'P2'
  type: typeof CONTRACTUELLE_TYPE
  statut: 'A_FAIRE'
} {
  return {
    partiePrenante: (ppNom ?? '').trim(),
    mesure: contractualClauseTitle(tag, label, ppNom),
    description: description ?? '',
    priorite: 'P2',
    type: CONTRACTUELLE_TYPE,
    statut: 'A_FAIRE',
  }
}

/**
 * Regroupe des mesures par prestataire (champ `partiePrenante`). Les mesures sans
 * prestataire sont rangées sous la clé `''`. Conserve l'ordre d'apparition.
 */
export function groupMeasuresByPartiePrenante<T extends { partiePrenante?: unknown }>(
  measures: T[],
): { partiePrenante: string; measures: T[] }[] {
  const order: string[] = []
  const byPP = new Map<string, T[]>()
  for (const m of measures ?? []) {
    const pp = typeof m.partiePrenante === 'string' ? m.partiePrenante.trim() : ''
    if (!byPP.has(pp)) {
      byPP.set(pp, [])
      order.push(pp)
    }
    byPP.get(pp)!.push(m)
  }
  return order.map(pp => ({ partiePrenante: pp, measures: byPP.get(pp)! }))
}
