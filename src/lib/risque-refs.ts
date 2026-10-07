// ─── Références R1, R2… des risques d'un projet (PUR) ─────────────────────────
// Numérotation stable pour toute la page projet (matrice brut / actuel / résiduel, filtre par catégorie, plans
// d'action) : du plus critique au moins critique selon la cotation actuelle (G×V), égalités dans l'ordre reçu.
// Testé : risque-refs.test.ts.
import { cotations, type CotationRow } from '@/lib/cotation-risque'

export function refsRisques(risques: readonly { id: string; g: number; v: number }[]): Map<string, string> {
  return new Map(risques
    .map((r, idx) => ({ id: r.id, score: r.g * r.v, idx }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .map((r, i) => [r.id, `R${i + 1}`]))
}

/** Références d'après la cotation actuelle de chaque risque (actuel ← brut quand absente). */
export function refsRisquesCotes(risques: readonly (CotationRow & { id: string })[]): Map<string, string> {
  return refsRisques(risques.map(r => ({ id: r.id, ...cotations(r).actuel })))
}
