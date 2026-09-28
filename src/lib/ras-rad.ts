// ─── RAS / RAD — déclaration et tableau de bord d'appétence (PUR) ────────────
// Vue de gouvernance qui assemble :
//  - la DÉCLARATION (RAS) : seuils d'appétit (global + par catégorie) et niveaux
//    de maturité visés par référentiel ;
//  - le TABLEAU DE BORD (RAD) : position réelle face à ces limites — risques hors
//    appétit (registre), écarts de maturité, KRI en alerte — avec un voyant par
//    indicateur et un voyant global (le pire renseigné).
// Voyants : VERT (dans les limites), ORANGE (vigilance), ROUGE (limite franchie),
// GRIS (non renseigné). Règles explicites, testées ; aucun libellé ici.

export type Voyant = 'VERT' | 'ORANGE' | 'ROUGE' | 'GRIS'
const ORDRE: Record<Voyant, number> = { GRIS: 0, VERT: 1, ORANGE: 2, ROUGE: 3 }

/** Appétit : un seul risque au-dessus de son seuil franchit la limite. */
export function voyantAppetit(s: { evalues: number; horsAppetit: number }): Voyant {
  if (s.evalues === 0) return 'GRIS'
  return s.horsAppetit > 0 ? 'ROUGE' : 'VERT'
}

/** Maturité : écart d'un niveau = vigilance ; deux niveaux ou plus = limite franchie. */
export function voyantMaturite(s: { assessed: number; belowTarget: number; topGaps: { gap: number }[] }): Voyant {
  if (s.assessed === 0) return 'GRIS'
  if (s.belowTarget === 0) return 'VERT'
  return s.topGaps.some(g => g.gap >= 2) ? 'ROUGE' : 'ORANGE'
}

/** KRI : un KRI critique franchit la limite ; un KRI en alerte appelle la vigilance. */
export function voyantKri(s: { total: number; alerte: number; critique: number }): Voyant {
  if (s.total === 0) return 'GRIS'
  if (s.critique > 0) return 'ROUGE'
  return s.alerte > 0 ? 'ORANGE' : 'VERT'
}

/** Voyant global : le pire des voyants renseignés (GRIS ignoré). */
export function voyantGlobal(voyants: Voyant[]): Voyant {
  return voyants.reduce<Voyant>((worst, v) => (ORDRE[v] > ORDRE[worst] ? v : worst), 'GRIS')
}
