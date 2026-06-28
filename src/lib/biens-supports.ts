/**
 * biens-supports.ts — Helpers biens supports (Atelier 1).
 *
 * Association biens supports ↔ valeurs métier en N‑N (issue #1) : un bien support
 * peut soutenir plusieurs valeurs métier (utile pour mettre en évidence les biens
 * transverses, donc critiques). Stocké en JSON dans Cadrage.biensSupports.
 *
 * Rétro‑compatibilité : les analyses existantes portent l'ancien champ singulier
 * `valeurMetierId`. `bienValeurMetierIds` lit indifféremment l'ancien et le nouveau
 * format, et `normalizeBienVmLinks` convertit une fois pour toutes au chargement.
 *
 * Module pur → testé unitairement (biens-supports.test.ts).
 */

export interface BienSupportLike {
  valeurMetierIds?: unknown
  valeurMetierId?: unknown
  [k: string]: unknown
}

/** Liste (dédupliquée, sans valeurs vides) des valeurs métier liées à un bien support. */
export function bienValeurMetierIds(bien: BienSupportLike | null | undefined): string[] {
  if (!bien) return []
  const raw = Array.isArray(bien.valeurMetierIds)
    ? bien.valeurMetierIds
    : bien.valeurMetierId != null && bien.valeurMetierId !== ''
      ? [bien.valeurMetierId]
      : []
  const out: string[] = []
  for (const v of raw) {
    const id = String(v ?? '').trim()
    if (id && !out.includes(id)) out.push(id)
  }
  return out
}

/**
 * Normalise un bien support au format N‑N : `valeurMetierIds: string[]`, en
 * absorbant l'ancien `valeurMetierId`. Renvoie un nouvel objet (non destructif),
 * sans le champ singulier obsolète.
 */
export function normalizeBienVmLinks<T extends BienSupportLike>(
  bien: T,
): Omit<T, 'valeurMetierId'> & { valeurMetierIds: string[] } {
  const ids = bienValeurMetierIds(bien)
  const out = { ...bien, valeurMetierIds: ids } as Omit<T, 'valeurMetierId'> & {
    valeurMetierIds: string[]
    valeurMetierId?: unknown
  }
  delete out.valeurMetierId
  return out
}
