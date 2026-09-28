// ─── Propriétaire d'un risque d'analyse (saisie directe) — module PUR ────────
// P3 de l'audit des méthodes : ISO/IEC 27005:2022 §7.2.2 (identifier les
// propriétaires des risques) et ISO/IEC 27001:2022 §6.1.2 c) 2). Le propriétaire
// est une PERSONNE ou une ENTITÉ ayant la responsabilité et l'autorité de gérer le
// risque : texte libre (comme `RiskItem.proprietaire` du registre), suggéré à partir
// des noms des membres de l'organisation et de ses entités responsables.

/** Valeur de filtre « sans propriétaire ». */
export const OWNER_NONE = '__none__'

/** Propriétaire nettoyé (trim, 200 caractères max) ; vide ou non-texte → null. */
export function sanitizeProprietaire(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, 200)
  return s || null
}

/** Suggestions : noms des membres puis entités, dédoublonnés (casse), triés. */
export function ownerSuggestions(memberNames: readonly (string | null | undefined)[], entites: readonly string[]): string[] {
  const seen = new Map<string, string>()
  for (const raw of [...memberNames, ...entites]) {
    const v = sanitizeProprietaire(raw)
    if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
}

/** Propriétaires présents dans le registre (options du filtre), triés. */
export function ownerFilterOptions(rows: readonly { proprietaire?: string | null }[]): string[] {
  return ownerSuggestions(rows.map(r => r.proprietaire), [])
}

/** Filtre : '' = tous ; OWNER_NONE = sans propriétaire ; sinon égalité stricte. */
export function filterByOwner<T extends { proprietaire?: string | null }>(rows: T[], filter: string): T[] {
  if (!filter) return rows
  if (filter === OWNER_NONE) return rows.filter(r => !r.proprietaire)
  return rows.filter(r => r.proprietaire === filter)
}
