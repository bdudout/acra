// ─── Vue « toutes les organisations » du super-administrateur (PUR) ───────────
// Certaines pages portent sur UNE organisation (appétence, registre IA, plans de contrôle et d'audit, rapports…). Sans
// organisation active, le super-administrateur reçoit un message d'information plutôt qu'un 404 ou une redirection
// muette. Testé : choisir-organisation.test.ts. UI : components/ChoisirOrganisation.

/** Vrai si l'utilisateur est super-administrateur et qu'aucune organisation n'est sélectionnée. */
export function superAdminSansOrganisation(instanceRole: string | null | undefined, activeOrgId: string | null | undefined): boolean {
  return instanceRole === 'SUPER_ADMIN' && !activeOrgId
}
