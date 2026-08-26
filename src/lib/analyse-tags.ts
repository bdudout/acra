// ─── Tags / programme des analyses (regroupement pour grandes organisations) ──
// Champ optionnel multi-valeurs (texte libre) permettant de regrouper/filtrer les
// analyses par programme, business unit ou périmètre. Logique PURE, testée.

const TAG_MAX = 20   // nombre de tags par analyse
const TAG_LEN = 40   // longueur max d'un tag

/** Normalise une liste de tags : trim, non vides, plafonnés, dédupliqués (casse-insensible). */
export function cleanTags(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const x of v) {
    if (typeof x !== 'string') continue
    const s = x.trim().slice(0, TAG_LEN)
    if (!s) continue
    const key = s.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
    if (out.length >= TAG_MAX) break
  }
  return out
}

/** Découpe une saisie libre (virgules, points-virgules, retours ligne) en tags nettoyés. */
export function parseTagsInput(s: string): string[] {
  return cleanTags((s ?? '').split(/[,;\n]/g))
}

/** Filtre une liste d'analyses sur un tag (correspondance exacte, casse-insensible). */
export function filtrerParTag<T extends { tags?: string[] | null }>(list: T[], tag: string): T[] {
  const t = (tag ?? '').trim().toLocaleLowerCase()
  if (!t) return list
  return list.filter(a => (a.tags ?? []).some(x => x.toLocaleLowerCase() === t))
}

/** Tags distincts présents dans une liste d'analyses, triés (pour alimenter un filtre). */
export function tagsUniques<T extends { tags?: string[] | null }>(list: T[]): string[] {
  const seen = new Map<string, string>()
  for (const a of list) for (const t of a.tags ?? []) {
    const k = t.toLocaleLowerCase()
    if (!seen.has(k)) seen.set(k, t)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}
