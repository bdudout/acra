// ─── Date saisie dans un formulaire — PUR ─────────────────────────────────────
// Champ <input type="date"> (AAAA-MM-JJ, lu à minuit UTC) ou date ISO complète → Date ; vide / null → null (effacer) ;
// valeur illisible → undefined (le champ est ignoré, jamais d'erreur 500 côté base). Testé : date-saisie.test.ts.
export function dateSaisie(v: unknown): Date | null | undefined {
  if (v === null || v === '') return null
  if (typeof v !== 'string') return undefined
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00.000Z` : v)
  return Number.isNaN(d.getTime()) ? undefined : d
}
