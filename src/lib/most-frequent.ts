// Valeur de chaîne la plus fréquente d'une liste (pour proposer une valeur par
// défaut de champ, ex. l'entité la plus utilisée). Pure et testée ; vides/espaces
// ignorés ; '' si aucune valeur exploitable.
export function mostFrequentString(values: readonly (string | null | undefined)[]): string {
  const counts = new Map<string, number>()
  for (const v of values ?? []) {
    const s = (v ?? '').trim()
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1)
  }
  let best = ''
  let n = 0
  for (const [s, c] of counts) if (c > n) { best = s; n = c }
  return best
}
