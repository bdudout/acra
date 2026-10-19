// ─── Message d'erreur d'API côté interface ────────────────────────────────────
// Les gardes d'API (`withAccess`) renvoient des codes stables (`forbidden`, `rate_limited`…)
// et non plus un texte français : l'interface les traduit ici (i18n ×5, `t.apiErrors`)
// au lieu d'afficher le code brut. Les codes métier propres à un écran restent traduits
// par cet écran ; un code inconnu est rendu tel quel (comportement antérieur).

export const API_ERROR_CODES = ['unauthorized', 'organization_required', 'forbidden', 'rate_limited', 'invalid_body', 'not_found', 'ANALYSE_GELEE', 'CONFLIT_EDITION', 'ANALYSE_NON_SOUMISE', 'RISQUES_NON_COTES'] as const
export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

export function isApiErrorCode(code: unknown): code is ApiErrorCode {
  return typeof code === 'string' && (API_ERROR_CODES as readonly string[]).includes(code)
}

/** Message affichable pour `error` renvoyé par l'API : traduction d'un code de garde, sinon le texte reçu, sinon `fallback`. */
export function apiErrorMessage(error: unknown, t: { apiErrors: Record<ApiErrorCode, string> }, fallback: string): string {
  if (isApiErrorCode(error)) return t.apiErrors[error]
  return typeof error === 'string' && error ? error : fallback
}
