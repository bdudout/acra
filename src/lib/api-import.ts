// ─── Import en masse via l'API publique v1 ───────────────────────────────────
// Prépare un lot d'items (risques, contrôles) : valide chacun avec le validateur
// métier existant, nettoie les valides, cape la cardinalité et remonte les erreurs
// par index. Logique PURE (réutilise les libs testées) → testable sans DB.

export const API_IMPORT_MAX = 500

export interface ImportItemError { index: number; error: string }
export interface PreparedImport<C> { valid: C[]; errors: ImportItemError[]; skipped: number }

/**
 * Valide + nettoie une liste d'items d'import. `validate` renvoie un code d'erreur
 * i18n ou null ; les valides sont nettoyés par `clean`. Au-delà de `cap`, les items
 * excédentaires sont ignorés (comptés dans `skipped`).
 */
export function prepareImport<I, C>(
  items: unknown,
  validate: (i: I) => string | null,
  clean: (i: I) => C,
  cap: number = API_IMPORT_MAX,
): PreparedImport<C> {
  if (!Array.isArray(items)) return { valid: [], errors: [], skipped: 0 }
  const capped = items.slice(0, cap)
  const skipped = items.length - capped.length
  const valid: C[] = []
  const errors: ImportItemError[] = []
  capped.forEach((it, index) => {
    try {
      const err = validate(it as I)
      if (err) errors.push({ index, error: err })
      else valid.push(clean(it as I))
    } catch {
      // Item non-objet ou malformé (ex. null, primitive) : erreur, pas de crash.
      errors.push({ index, error: 'item_invalide' })
    }
  })
  return { valid, errors, skipped }
}
