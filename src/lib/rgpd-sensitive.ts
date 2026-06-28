/**
 * rgpd-sensitive.ts — Détection de catégories particulières de données (RGPD Art. 9).
 *
 * Heuristique par mots-clés sur les valeurs métier / biens supports déjà saisis,
 * pour alerter l'utilisateur (bandeau non bloquant) qu'il manipule probablement
 * des données sensibles → base légale renforcée, confidentialité élevée, AIPD.
 * 100 % local, pas d'IA. Module pur → testé unitairement.
 */

export const RGPD_ART9_CATEGORIES = [
  'sante', 'biometrie', 'genetique', 'opinions', 'religion', 'orientation', 'origine',
] as const

export type RgpdArt9Category = typeof RGPD_ART9_CATEGORIES[number]

// Mots-clés (minuscules, sans accents) volontairement spécifiques pour limiter les
// faux positifs (ex. « politique de sécurité » ne doit pas déclencher « opinions »).
const KEYWORDS: Record<RgpdArt9Category, string[]> = {
  sante: ['sante', 'medical', 'patient', 'maladie', 'diagnostic', 'pathologie', 'dpi', 'dossier patient', 'soin', 'handicap', 'prescription', 'medicament'],
  biometrie: ['biometr', 'empreinte digitale', 'reconnaissance faciale', 'iris', 'reconnaissance vocale'],
  genetique: ['genetiq', 'adn', 'genome', 'genomique'],
  opinions: ['opinion politique', 'appartenance syndicale', 'syndicat', 'syndical'],
  religion: ['religion', 'religieu', 'croyance', 'confession', 'conviction philosophique'],
  orientation: ['orientation sexuelle', 'sexualite', 'vie sexuelle'],
  origine: ['origine raciale', 'origine ethnique', 'appartenance ethnique'],
}

/** Minuscule + suppression des accents pour une comparaison robuste. */
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Renvoie les catégories Art. 9 détectées (triées, sans doublon) dans le texte
 * (nom + description) des entrées fournies. [] si rien de sensible.
 */
export function detectRgpdArt9(
  items: { nom?: string; description?: string }[],
): RgpdArt9Category[] {
  const hay = normalize(
    (items ?? []).map(i => `${i?.nom ?? ''} ${i?.description ?? ''}`).join('  '),
  )
  const found = RGPD_ART9_CATEGORIES.filter(cat =>
    KEYWORDS[cat].some(kw => hay.includes(kw)),
  )
  return found
}
