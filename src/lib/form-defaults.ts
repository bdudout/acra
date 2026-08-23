/**
 * Helpers purs pour faciliter la saisie des formulaires : valeurs par défaut et
 * suggestions d'autocomplétion. Aucune dépendance DOM/React → testable sans DB.
 *
 * Voir docs/specs/saisie-defauts-autocomplete.md
 */

/** Date du jour au format attendu par `<input type="date">` (YYYY-MM-DD), en heure locale. */
export function todayInputDate(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Clé de dédoublonnage insensible à la casse et aux accents (é → e). */
function normKey(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase()
}

/**
 * Valeurs distinctes, non vides, `trim`, pour alimenter un `<datalist>`.
 * Dédoublonnage insensible casse/accents (on garde la 1ʳᵉ casse rencontrée),
 * puis tri alphabétique local et troncature à `limit`.
 */
export function suggestionsFromValues(values: (string | null | undefined)[], limit = 50): string[] {
  const seen = new Map<string, string>() // clé normalisée → valeur d'origine
  for (const v of values) {
    const s = (v ?? '').trim()
    if (!s) continue
    const key = normKey(s)
    if (!seen.has(key)) seen.set(key, s)
  }
  return [...seen.values()]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .slice(0, limit)
}

/** Nom de responsable par défaut = utilisateur courant (trimé), sinon chaîne vide. */
export function defaultResponsable(currentUserName?: string | null): string {
  return (currentUserName ?? '').trim()
}
