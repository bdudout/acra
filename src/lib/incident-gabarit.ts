// ─── Gabarit de déclaration d'incident — PUR, léger (importable côté client) ──
// En-tête « À compléter » du gabarit (fr, en, de, es, it) et nettoyage des rubriques restées vides (recette n° 34).
// Testé : action-items.test.ts (normalizeIncident).

/** En-tête du gabarit, dans l'ordre fr, en, de, es, it (cf. incidentTemplate). */
export const ENTETES_A_COMPLETER = ['À compléter :', 'To complete:', 'Zu ergänzen:', 'Por completar:', 'Da completare:'] as const

/**
 * Description sans les rubriques vides du gabarit : retire l'en-tête « À compléter » et les lignes « - rubrique : »
 * restées sans valeur ; garde les rubriques renseignées et le texte libre. Tout vide → null.
 */
export function sansRubriquesVides(description: string | null | undefined): string | null {
  if (!description) return null
  const entetes = new Set<string>(ENTETES_A_COMPLETER)
  const lignes = description.split('\n').filter(ligne => {
    const t = ligne.trim()
    return t !== '' && !entetes.has(t) && !/^-\s.*:\s*$/.test(t)
  })
  return lignes.length ? lignes.join('\n').trim() : null
}
