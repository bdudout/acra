// ─── Secteurs d'activité masqués par une organisation (PUR) ───────────────────
// L'ADMIN réduit la liste des secteurs proposés à la saisie (analyse, projet). Stockés par libellé français canonique
// (SECTEURS_ACTIVITE), les listes traduites gardant le même ordre : le masque vaut dans toutes les langues. Une valeur
// déjà choisie reste visible ; tout masquer est refusé. Testé : secteurs-masques.test.ts.
import { SECTEURS_ACTIVITE } from '@/lib/ebios-data'

export function normalizeSecteursMasques(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const connus = new Set<string>(SECTEURS_ACTIVITE)
  const out = [...new Set(input.filter((x): x is string => typeof x === 'string' && connus.has(x)))]
  return out.length >= connus.size ? [] : out
}

/** Secteurs à proposer dans la langue affichée (`localises` dans l'ordre de SECTEURS_ACTIVITE). */
export function secteursVisibles(localises: readonly string[], masques: readonly string[], courant?: string | null): string[] {
  if (!masques.length) return [...localises]
  const masque = new Set(masques)
  return localises.filter((s, i) => s === courant || !masque.has(SECTEURS_ACTIVITE[i]))
}
