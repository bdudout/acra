/**
 * regulatory-guidance.ts — Obligations réglementaires différenciées selon le
 * statut de l'entité (issue #68).
 *
 * Le statut réglementaire (cf. lib/qualification.ts → Analyse.qualification) ne
 * doit pas rester décoratif : un OIV, une entité NIS2 (EEI) ou un OSE ont des
 * obligations concrètes (soumission à l'ANSSI, notification d'incident, exercice
 * de crise…). Cette fonction renvoie la liste des identifiants d'obligations à
 * afficher (libellés via i18n `workshop.a5.reg.<id>`). Module pur → testé.
 */
// Secteurs régulés (NIS2 haute criticité + régulations sectorielles FR) pour
// lesquels les modules Conformité/Qualification sont quasi-obligatoires.
const REGULATED_SECTOR_KEYWORDS = [
  'banque', 'finance', 'bancaire', 'assur', 'fintech', 'financ',
  'santé', 'sante', 'médico', 'medico', 'hospital', 'soin', 'health',
  'défense', 'defense', 'militaire', 'defence',
  'énergie', 'energie', 'utilities', 'energy', 'nucléaire', 'nucleaire',
  'eau', 'assainissement', 'water',
  'administration', 'public', 'collectivit', 'état', 'etat', 'government',
  'télécom', 'telecom', 'communication',
  'transport', 'logistique', 'logistics', 'aérien', 'aerien', 'ferroviaire',
  // Enseignement supérieur et recherche (ESR) — NIS2 Annexe II (recherche) — issue #101
  'recherche', 'research', 'université', 'universite', 'enseignement', 'esr',
]

/**
 * Faut-il suggérer d'activer les modules Conformité/Qualification (issue #73) ?
 * Vrai si un statut réglementaire est renseigné, ou si le secteur est régulé
 * (NIS2 haute criticité / régulations sectorielles). Pur, testé.
 */
export function suggestsComplianceModule(secteur?: string | null, statut?: string | null): boolean {
  if (statut && statut !== 'aucun') return true
  const s = (secteur ?? '').toLowerCase()
  if (!s) return false
  return REGULATED_SECTOR_KEYWORDS.some(k => s.includes(k))
}

/**
 * Notes d'usage du rapport (issues #70/#74) : opportunités réglementaires que le
 * rapport EBIOS RM peut couvrir. `doraArt8` si DORA est retenu (documentation du
 * risque ICT, art. 8 DORA) ; `homologationSSI` pour le secteur public (rapport
 * d'analyse de risques du dossier d'homologation SSI) ; `homologationII901` pour la
 * défense privée (BITD) opérant un SI Diffusion Restreinte — le rapport peut
 * constituer la pièce d'analyse de risques du dossier d'homologation II 901
 * (déclenché seulement si une valeur métier est classifiée IGI-1300 ≠ NP). Pur, testé.
 */
export function reportUsageNotes(frameworks?: string[] | null, secteur?: string | null, hasClassifiedVm?: boolean): string[] {
  const notes: string[] = []
  if ((frameworks ?? []).includes('DORA')) notes.push('doraArt8')
  if (/administration|public|collectivit|état|etat|government|établissement public/i.test(secteur ?? '')) notes.push('homologationSSI')
  // Défense privée (BITD) opérant un SI DR → homologation II 901 (issue #103)
  if (hasClassifiedVm && /défense|defense|militaire|defence|armement|bitd|dga/i.test(secteur ?? '')) notes.push('homologationII901')
  // Assurance : le rapport alimente l'évaluation ORSA (Solvabilité II art. 45) (issue #96)
  if (/assur|mutuelle|insurance|réassur|reassur/i.test(secteur ?? '')) notes.push('orsaSolva2')
  return notes
}

// NIS2 — Annexe I (haute criticité → entité essentielle) et Annexe II (autres
// secteurs critiques → entité importante). La défense/sécurité nationale est
// EXCLUE du champ NIS2. Matching par mots-clés (secteur stocké localisé).
const NIS2_ESSENTIELLE_KW = [
  'administration', 'public', 'collectivit', 'état', 'etat', 'government',
  'banque', 'bancaire', 'finance', 'financ', 'assur', 'fintech',
  'énergie', 'energie', 'utilities', 'energy', 'eau', 'assainissement', 'water',
  'santé', 'sante', 'médico', 'medico', 'hospital', 'health',
  'télécom', 'telecom', 'communication',
  'transport', 'logistique', 'logistics',
  'informatique', 'numérique', 'numerique', 'digital', 'cloud', 'saas',
]
const NIS2_IMPORTANTE_KW = [
  'industrie', 'manufactur', 'usine', 'industry',
  'agro', 'agricol', 'aliment', 'food',
  'e-commerce', 'ecommerce', 'marketplace',
  'recherche', 'research', 'université', 'universite', 'enseignement', 'esr',
  'poste', 'postal', 'déchet', 'dechet', 'waste', 'chimie', 'chemical',
]
// Secteurs explicitement HORS NIS2 (priment sur le matching par mots-clés).
const NIS2_EXCLUS_KW = ['défense', 'defense', 'militaire', 'defence', 'sécurité nationale', 'securite nationale']

/**
 * Statut NIS2 probable de l'entité selon son secteur (issues #85/#92) :
 * 'essentielle' (Annexe I), 'importante' (Annexe II) ou null (hors NIS2).
 * Pur, testé. Ne présume pas de la taille (à confirmer par l'utilisateur).
 */
export function nis2Classification(secteur?: string | null): 'essentielle' | 'importante' | null {
  const s = (secteur ?? '').toLowerCase()
  if (!s) return null
  if (NIS2_EXCLUS_KW.some(k => s.includes(k))) return null
  if (NIS2_ESSENTIELLE_KW.some(k => s.includes(k))) return 'essentielle'
  if (NIS2_IMPORTANTE_KW.some(k => s.includes(k))) return 'importante'
  return null
}

/** DORA prime sur NIS2 (lex specialis) pour les entités financières (issue #84). */
export function doraPrevailsOverNis2(secteur?: string | null): boolean {
  const s = (secteur ?? '').toLowerCase()
  return ['banque', 'bancaire', 'finance', 'financ', 'assur', 'fintech'].some(k => s.includes(k))
}

/**
 * Autorité sectorielle NIS2 (registre + notification) selon le secteur (issue #93).
 * La transposition française rattache chaque secteur régulé à une autorité de
 * référence (ANS santé, ACPR/AMF finance-DORA, ARCEP télécoms, CRE énergie,
 * ministère de l'Environnement pour l'eau) ; à défaut, texte générique ANSSI.
 * Renvoie le couple de clés [enregistrement, notification d'incident].
 */
export function eeiAuthorityKeys(secteur?: string | null): [string, string] {
  const s = secteur ?? ''
  if (/sant|médico|medico|hospital|health/i.test(s)) return ['eeiRegisterSante', 'eeiIncidentSante']
  if (/banqu|financ|bancaire|assur|fintech|mutuelle|bourse|marché|marche/i.test(s)) return ['eeiRegisterFinance', 'eeiIncidentFinance']
  if (/télécom|telecom|télécommunication|telecommunication|opérateur|operateur|\bfai\b|telco/i.test(s)) return ['eeiRegisterTelecom', 'eeiIncidentTelecom']
  if (/énergie|energie|energy|électric|electric|gaz|nucléaire|nucleaire|pétrol|petrol/i.test(s)) return ['eeiRegisterEnergie', 'eeiIncidentEnergie']
  if (/\beau\b|assainissement|water|environnement/i.test(s)) return ['eeiRegisterEau', 'eeiIncidentEau']
  return ['eeiRegister', 'eeiIncident']
}

export function regulatoryObligations(statut?: string | null, secteur?: string | null): string[] {
  switch (statut) {
    case 'OIV':
      // LPM / arrêtés SIIV : homologation soumise à l'ANSSI, guide PA sectoriel,
      // exercice de crise annuel. Double régime : un OIV est généralement AUSSI
      // entité essentielle au sens de NIS2 (issue #98).
      return ['oivAnssiSubmit', 'oivSectorGuide', 'oivCrisisExercise', 'oivNis2Cumul']
    case 'EEI':
      // NIS2 : enregistrement + notification d'incident, routés vers l'autorité
      // sectorielle réelle selon le secteur (issue #93 ; santé = #81).
      return eeiAuthorityKeys(secteur)
    case 'OSE':
      // NIS1 (hérité) : mesures de sécurité + notification d'incident significatif.
      return ['oseSecurity', 'oseIncident']
    default:
      return []
  }
}
