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
 * d'analyse de risques du dossier d'homologation SSI). Pur, testé.
 */
export function reportUsageNotes(frameworks?: string[] | null, secteur?: string | null): string[] {
  const notes: string[] = []
  if ((frameworks ?? []).includes('DORA')) notes.push('doraArt8')
  if (/administration|public|collectivit|état|etat|government|établissement public/i.test(secteur ?? '')) notes.push('homologationSSI')
  return notes
}

export function regulatoryObligations(statut?: string | null, secteur?: string | null): string[] {
  // Secteur santé : depuis NIS2 (oct. 2024) l'autorité sectorielle est l'ANS
  // (enregistrement via MonEspaceNIS2, notification au CERT Santé), pas l'ANSSI.
  const sante = /sant|médico|medico|hospital|health/i.test(secteur ?? '')
  switch (statut) {
    case 'OIV':
      // LPM / arrêtés SIIV : homologation soumise à l'ANSSI, guide PA sectoriel,
      // exercice de crise annuel.
      return ['oivAnssiSubmit', 'oivSectorGuide', 'oivCrisisExercise']
    case 'EEI':
      // NIS2 : enregistrement auprès de l'autorité + notification d'incident.
      // Santé → autorité sectorielle ANS / CERT Santé (issue #81).
      return sante ? ['eeiRegisterSante', 'eeiIncidentSante'] : ['eeiRegister', 'eeiIncident']
    case 'OSE':
      // NIS1 (hérité) : mesures de sécurité + notification d'incident significatif.
      return ['oseSecurity', 'oseIncident']
    default:
      return []
  }
}
