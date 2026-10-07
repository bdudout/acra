// ─── Projet 360 : suppression d'un risque soumise à validation (PUR) ──────────
// Selon la configuration (OrganizationConfig.projetSuppressionValidation, activée par défaut), retirer un risque d'un
// projet 360 passe par une demande validée par le gestionnaire des risques — ou par le RSSI pour un risque cyber.
// Un validateur (ou un administrateur) supprime directement. Testé : projet360-suppression.test.ts.

export type Validateur = 'RSSI' | 'RISK_MANAGER'

export const validateurSuppression = (domaine: string | null | undefined): Validateur => (domaine === 'CYBER' ? 'RSSI' : 'RISK_MANAGER')

export function peutValiderSuppression(role: string, domaine: string | null | undefined, opts: { petiteStructure?: boolean } = {}): boolean {
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return true
  if (opts.petiteStructure && (role === 'RSSI' || role === 'RISK_MANAGER')) return true
  return role === validateurSuppression(domaine)
}

export function decisionSuppression(a: { methode: string; validationActive: boolean; role: string; domaine: string | null | undefined; petiteStructure?: boolean }): 'SUPPRIMER' | 'DEMANDER' {
  if (a.methode !== 'PROJET_360' || !a.validationActive) return 'SUPPRIMER'
  return peutValiderSuppression(a.role, a.domaine, { petiteStructure: a.petiteStructure }) ? 'SUPPRIMER' : 'DEMANDER'
}
