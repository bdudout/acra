// ─── Gel d'une analyse après acceptation des risques résiduels ──────────────
// Gouvernance : une fois que la Direction métier a ACCEPTÉ les risques résiduels,
// l'analyse est figée (lecture seule) tant que la fonctionnalité est active pour
// l'organisation (OrganizationConfig.gelApresAcceptationActive). Toute modification
// exige d'ouvrir une NOUVELLE VERSION (révision), ce qui remet la décision
// d'acceptation à « en attente ».
//
// Règle PURE et testée — l'API (garde de sauvegarde), la page (lecture seule) et
// le panneau d'acceptation la lisent, sans la redériver.

/** Statut d'acceptation des risques résiduels qui déclenche le gel. */
export const STATUT_GEL = 'ACCEPTES'

/**
 * Une analyse est-elle gelée ? Vrai uniquement si le gel est activé pour l'org
 * ET que les risques résiduels ont été acceptés.
 */
export function analyseGelee(risquesResiduelsStatut: string | null | undefined, gelActive: boolean): boolean {
  return gelActive === true && risquesResiduelsStatut === STATUT_GEL
}
