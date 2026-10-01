// ─── Déclaré vs constaté : la conformité déclarée confrontée au contrôle et à l'audit ─
// Module PUR sans dépendance (utilisé côté client). Sur la page de conformité, chaque exigence
// affiche ce que constatent le contrôle permanent (efficacité des contrôles qui la couvrent) et
// l'audit (constats ouverts), calculé par couverture-referentiel.ts. Une exigence déclarée
// « conforme » alors qu'une anomalie est constatée est signalée en DIVERGENCE ; le statut déclaré
// n'est jamais modifié automatiquement (la décision reste au responsable de la conformité).

/** Couverture d'une exigence par les contrôles/audits (forme renvoyée par /api/referentiels/couverture). */
export interface CouvertureExigenceLite {
  ref: string
  statut: 'NON_COUVERT' | 'CONFORME' | 'PARTIEL' | 'ANOMALIE'
  nbControles: number
  nbAnomaliesAudit: number
}

/** Ce que le contrôle et l'audit disent d'une exigence, et s'il contredit la déclaration. */
export interface ConstatSurExigence extends CouvertureExigenceLite {
  divergent: boolean
}

export function confronterDeclaration(
  parExigence: CouvertureExigenceLite[],
  declarations: { ref: string; statut: string }[],
): Map<string, ConstatSurExigence> {
  const declare = new Map(declarations.map(d => [d.ref, d.statut]))
  return new Map(parExigence
    .filter(e => e.statut !== 'NON_COUVERT')
    .map(e => [e.ref, { ...e, divergent: e.statut === 'ANOMALIE' && declare.get(e.ref) === 'conforme' }]))
}
