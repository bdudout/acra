// ─── Contexte d'appréciation (saisie directe) — module PUR ───────────────────
// Périmètre + objectifs/critères de l'appréciation, pour les méthodes à saisie
// directe (ISO/IEC 27005, NIST SP 800-30). Étape « Établissement du contexte » :
// jusqu'ici affichée en lecture seule (toujours « Non renseigné » faute d'écran de
// saisie). Ces deux champs sont persistés sur `Cadrage` (perimetre / objectifsEtude),
// partagés avec EBIOS RM. Module pur (aucun accès DB) → testé unitairement.

/** Longueur maximale d'un champ de contexte (garde-fou anti-abus). */
export const CONTEXTE_MAX_LEN = 5000

/** Contexte assaini (chaînes bornées, toujours définies). */
export interface ContexteData {
  perimetre: string
  objectifsEtude: string
}

/** Normalise une entrée quelconque en contexte sûr (trim + bornage ; non-chaîne → ''). */
export function sanitizeContexte(input: unknown): ContexteData {
  const o = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const s = (v: unknown) => (typeof v === 'string' ? v : '').trim().slice(0, CONTEXTE_MAX_LEN)
  return { perimetre: s(o.perimetre), objectifsEtude: s(o.objectifsEtude) }
}
