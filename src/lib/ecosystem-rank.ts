// ─── Classement des tiers de l'écosystème (priorisation pour la carto) ───────
// Le radar du tableau de bord ne peut pas afficher lisiblement des centaines de
// tiers : on n'y montre que les plus PRIORITAIRES. Priorité = tiers critiques
// d'abord, puis niveau de MENACE (exposition / fiabilité) décroissant, puis
// exposition brute. Pur et testé ; la vue plein écran /ecosysteme affiche tout.

export interface RankableTier {
  exposition: number
  fiabilite: number
  critique?: boolean
}

/** Niveau de menace d'un tiers = exposition / fiabilité (repli : exposition brute). */
export function menaceTier(exposition: number, fiabilite: number): number {
  const e = Number(exposition) || 0
  const f = Number(fiabilite) || 0
  return f > 0 ? e / f : e
}

/**
 * Trie les tiers par priorité décroissante et plafonne à `max`.
 * Ordre : critique (true avant false) → menace décroissante → exposition décroissante.
 * Stable et non destructif (ne modifie pas le tableau d'entrée).
 */
export function rankEcosystemTiers<T extends RankableTier>(parties: readonly T[], max: number): T[] {
  const sorted = [...parties].sort((a, b) => {
    const ca = a.critique ? 1 : 0
    const cb = b.critique ? 1 : 0
    if (ca !== cb) return cb - ca
    const ma = menaceTier(a.exposition, a.fiabilite)
    const mb = menaceTier(b.exposition, b.fiabilite)
    if (mb !== ma) return mb - ma
    return (Number(b.exposition) || 0) - (Number(a.exposition) || 0)
  })
  return max > 0 ? sorted.slice(0, max) : sorted
}
