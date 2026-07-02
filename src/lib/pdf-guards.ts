// Gardes de rendu du template PDF — retournent des BOOLÉENS stricts.
//
// react-pdf lève « Invalid '' string child outside <Text> component » (et casse
// l'export) dès qu'une chaîne vide se retrouve enfant direct d'un <View>/<Page>.
// Le piège classique : `{champString && <View/>}` — si `champString === ''`,
// l'expression vaut `''` (et non `false`), donc react-pdf tente de rendre cette
// chaîne vide hors <Text>. Toujours coercer les gardes de champs texte en
// booléen (ces helpers, ou l'idiome `cond ? (...) : null`).

/** Vrai si la valeur est une chaîne non vide (espaces ignorés). */
export function isNonEmptyText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/** Vrai si le cadrage a un contexte à afficher (périmètre ou objectifs). */
export function hasCadrageContexte(cadrage: { perimetre?: unknown; objectifsEtude?: unknown } | null | undefined): boolean {
  if (!cadrage) return false
  return isNonEmptyText(cadrage.perimetre) || isNonEmptyText(cadrage.objectifsEtude)
}
