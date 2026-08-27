// ─── Autocomplétion de champs — cœur pur ─────────────────────────────────────
// Classe des valeurs candidates (valeurs déjà saisies dans l'organisation) pour
// suggérer une saisie. Réduit la re-frappe et les doublons dans les registres.
// Logique PURE et testable ; la collecte des candidats vit côté serveur.

/** Champs texte libres proposant de l'autocomplétion (whitelist). */
export const SUGGESTION_FIELDS = ['organisation', 'tag'] as const
export type SuggestionField = (typeof SUGGESTION_FIELDS)[number]

export function isSuggestionField(v: unknown): v is SuggestionField {
  return typeof v === 'string' && (SUGGESTION_FIELDS as readonly string[]).includes(v)
}

/**
 * Classe/filtre des candidats pour une requête. Déduplique (insensible à la
 * casse, 1ʳᵉ graphie conservée). Avec requête : ne garde que les sous-chaînes,
 * les préfixes d'abord, exclut l'égalité exacte (rien à suggérer). Sans requête :
 * tri alphabétique. Plafonné à `limit`.
 */
export function rankSuggestions(candidates: readonly (string | null | undefined)[], query: string, limit = 8): string[] {
  const q = (query ?? '').trim().toLowerCase()
  const seen = new Map<string, string>()
  for (const c of candidates) {
    if (typeof c !== 'string') continue
    const v = c.trim()
    if (!v) continue
    const low = v.toLowerCase()
    if (!seen.has(low)) seen.set(low, v)
  }
  let items = [...seen.values()]
  if (q) {
    items = items.filter(v => {
      const low = v.toLowerCase()
      return low.includes(q) && low !== q
    })
    items.sort((a, b) => {
      const ap = a.toLowerCase().startsWith(q) ? 0 : 1
      const bp = b.toLowerCase().startsWith(q) ? 0 : 1
      if (ap !== bp) return ap - bp
      return a.localeCompare(b)
    })
  } else {
    items.sort((a, b) => a.localeCompare(b))
  }
  return items.slice(0, Math.max(0, limit))
}
