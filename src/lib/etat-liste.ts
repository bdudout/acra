// ─── État d'une liste pendant un rechargement (n° 43) — PUR ──────────────────
// Après un enregistrement, une liste se recharge : sans précaution elle affiche « Aucun … »
// ou un compteur périmé pendant plusieurs secondes et l'utilisateur croit sa saisie perdue.
// `etatListe` dit quoi afficher ; `fusionnerEnregistrement` intègre tout de suite l'élément
// renvoyé par l'API (création en tête, modification à sa place). Testé : etat-liste.test.ts.

export type EtatListe = 'vide' | 'chargement' | 'miseAJour' | 'liste'

export function etatListe(nb: number, enChargement: boolean): EtatListe {
  if (nb === 0) return enChargement ? 'chargement' : 'vide'
  return enChargement ? 'miseAJour' : 'liste'
}

export function fusionnerEnregistrement<T extends { id: string }>(liste: T[], enregistre: T | null | undefined): T[] {
  if (!enregistre || typeof enregistre.id !== 'string') return liste
  return liste.some(x => x.id === enregistre.id)
    ? liste.map(x => (x.id === enregistre.id ? enregistre : x))
    : [enregistre, ...liste]
}
