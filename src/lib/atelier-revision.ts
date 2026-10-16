// ─── Verrou optimiste des ateliers (T9) ───────────────────────────────────────
// Chaque sauvegarde d'atelier RÉÉCRIT tout l'atelier (suppression puis recréation) : entre deux
// éditeurs, le dernier enregistrement effaçait silencieusement l'autre. Un compteur de révision
// par atelier (`Analyse.revisionAtelierN`) est envoyé par le client (`If-Match`) et comparé de
// façon atomique à l'enregistrement ; écart → 409 `CONFLIT_EDITION`.

export type RevisionField = 'revisionAtelier1' | 'revisionAtelier2' | 'revisionAtelier3' | 'revisionAtelier4' | 'revisionAtelier5'

/** Colonne de révision de l'atelier `num` (1 à 5), sinon null. */
export function revisionField(num: number): RevisionField | null {
  return Number.isInteger(num) && num >= 1 && num <= 5 ? (`revisionAtelier${num}` as RevisionField) : null
}

/** Révision attendue lue dans `If-Match` (entier ≥ 0, guillemets ETag tolérés) ; absente ou invalide → null. */
export function parseIfMatch(header: string | null | undefined): number | null {
  const v = (header ?? '').trim().replace(/^"(.*)"$/, '$1')
  return /^\d{1,9}$/.test(v) ? Number(v) : null
}
