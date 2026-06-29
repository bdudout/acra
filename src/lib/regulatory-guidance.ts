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
export function regulatoryObligations(statut?: string | null): string[] {
  switch (statut) {
    case 'OIV':
      // LPM / arrêtés SIIV : homologation soumise à l'ANSSI, guide PA sectoriel,
      // exercice de crise annuel.
      return ['oivAnssiSubmit', 'oivSectorGuide', 'oivCrisisExercise']
    case 'EEI':
      // NIS2 : enregistrement auprès de l'autorité + notification d'incident.
      return ['eeiRegister', 'eeiIncident']
    case 'OSE':
      // NIS1 (hérité) : mesures de sécurité + notification d'incident significatif.
      return ['oseSecurity', 'oseIncident']
    default:
      return []
  }
}
