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

/** Catégorie de données sensibles au sens de l'art. 9 RGPD (santé, opinions, biométrie…). */
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

/**
 * Critère WP248 rév. 01 n° 7 « données concernant des personnes vulnérables » : enfants, salariés (déséquilibre du rapport
 * de force), patients, personnes âgées, demandeurs d'asile, personnes handicapées… Déduit des catégories de personnes
 * concernées saisies (FR, EN, DE, ES, IT), début de mot uniquement pour éviter les faux positifs. Aide : le DPO décide.
 */
const VULNERABLES = [
  'patient', 'paciente', 'pazient', 'malade', 'mineur', 'enfant', 'eleve', 'personnes agee', 'personne agee', 'senior', 'salarie', 'employe',
  'demandeur d asile', 'demandeurs d asile', 'refugie', 'handicap', 'resident', 'beneficiaires de l aide sociale',
  'minor', 'child', 'pupil', 'elderly', 'employee', 'staff', 'asylum', 'disabled',
  'minderjahrig', 'kind', 'schuler', 'altere', 'beschaftigt', 'arbeitnehmer', 'mitarbeit', 'asylbewerber',
  'menor', 'nino', 'nina', 'alumno', 'personas mayores', 'empleado', 'trabajador', 'solicitante de asilo',
  'minore', 'bambin', 'alunn', 'anzian', 'dipendent', 'lavorator', 'richiedent',
]
const VULNERABLES_RE = new RegExp(`(^|[^a-z])(${VULNERABLES.map(m => m.replace(/ /g, '[^a-z]+')).join('|')})`)
export function detectPersonnesVulnerables(categoriesPersonnes: string[]): boolean {
  return (categoriesPersonnes ?? []).some(c => VULNERABLES_RE.test(normalize(c).replace(/[’']/g, ' ')))
}
