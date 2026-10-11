// ─── Avancement d'une analyse (atelier courant) — PUR ─────────────────────────
// Recette n° 14 : l'atelier courant (✓ des ateliers, « Reprendre (Atelier n) », % du tableau de bord) ne progresse que
// sur l'action explicite « Passer à l'atelier suivant » (POST /api/analyses/[id]/workshop/[num]) — jamais sur une
// sauvegarde automatique. Il ne recule jamais et plafonne à 5. Testé : analyse-avancement.test.ts.
export function atelierApresAvancement(courant: number, atelierTermine: number): number {
  return Math.max(courant, Math.min(atelierTermine + 1, 5))
}
