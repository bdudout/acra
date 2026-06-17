/**
 * ebios-gravite.ts — Héritage de la gravité des scénarios stratégiques (Atelier 3).
 *
 * Implémente la fiche méthode Club EBIOS « Définition de la gravité des scénarios
 * stratégiques » (v1.0, 2025) :
 *  - la gravité d'un scénario stratégique est HÉRITÉE des événements redoutés (ER)
 *    liés à son objectif visé (évalués à l'Atelier 1) ;
 *  - si plusieurs ER sont liés au même objectif visé, on retient la gravité la plus
 *    élevée (max) ;
 *  - garde-fou : si les ER liés couvrent plusieurs valeurs métier de gravités
 *    différentes, retenir le max surévalue le risque — on le signale pour proposer
 *    de scinder le scénario par valeur métier ciblée.
 *
 * Module pur (sans React) → testé unitairement (ebios-gravite.test.ts).
 */

export interface ErLike {
  id: string
  /** Gravité de l'ER (1..4). `graviteDefaut` (exemples/A1) ou `gravite` acceptés. */
  graviteDefaut?: number
  gravite?: number
  valeurMetierId?: string
}

const clamp14 = (v: number) => Math.max(1, Math.min(4, v))

function graviteOf(er: ErLike): number {
  return er.graviteDefaut ?? er.gravite ?? 0
}

/** ER liés (par id) à un scénario, dans l'ordre de la liste source. */
function linkedErs(erIds: string[], ers: ErLike[]): ErLike[] {
  const set = new Set(erIds)
  return ers.filter(er => set.has(er.id))
}

/**
 * Gravité héritée = max des gravités des ER liés. Si aucun ER lié (ou inconnus),
 * retourne `fallback` (la valeur manuelle/défaut courante du scénario).
 */
export function graviteHeritee(erIds: string[], ers: ErLike[], fallback = 2): number {
  const linked = linkedErs(erIds, ers)
  if (linked.length === 0) return clamp14(fallback)
  const max = Math.max(...linked.map(graviteOf))
  return max > 0 ? clamp14(max) : clamp14(fallback)
}

/** Valeurs métier distinctes concernées par les ER liés. */
export function valeursMetierConcernees(erIds: string[], ers: ErLike[]): string[] {
  const vms = new Set<string>()
  for (const er of linkedErs(erIds, ers)) {
    if (er.valeurMetierId) vms.add(er.valeurMetierId)
  }
  return [...vms]
}

/**
 * Vrai si les ER liés couvrent plusieurs valeurs métier de gravités DIFFÉRENTES :
 * dans ce cas, retenir la gravité max surévalue le scénario (cas 4 vs 3 de la fiche),
 * et il est recommandé de scinder le SS par valeur métier ciblée.
 */
export function risqueSurevaluation(erIds: string[], ers: ErLike[]): boolean {
  const linked = linkedErs(erIds, ers).filter(er => er.valeurMetierId)
  const vms = new Set(linked.map(er => er.valeurMetierId))
  if (vms.size < 2) return false
  const gravites = linked.map(graviteOf)
  return Math.max(...gravites) !== Math.min(...gravites)
}
