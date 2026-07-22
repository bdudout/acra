// Identifiants et données déterministes partagés par le seed E2E et les tests.
// Tout est préfixé `e2e_` pour un nettoyage sûr (globalTeardown).
export const E2E = {
  password: 'E2e@Passw0rd!',
  orgId: 'e2e_org',
  users: {
    porteur: { id: 'e2e_porteur', email: 'e2e.porteur@example.test', role: 'ANALYSTE' as const },
    rssi:    { id: 'e2e_rssi',    email: 'e2e.rssi@example.test',    role: 'RSSI' as const },
    metier:  { id: 'e2e_metier',  email: 'e2e.metier@example.test',  role: 'DIRECTION_METIER' as const },
  },
  analyseId: 'e2e_analyse',
  referentiel: 'ISO27001',
  // Contrôles du socle : un non-conforme (dérogeable) + un conforme.
  socle: [
    { ref: '5.1', statut: 'non_conforme' },
    { ref: '5.2', statut: 'conforme' },
  ],
}
