// ─── Synthèse d'un projet 360 (page de présentation) — PUR ───────────────────
// Répartition des risques par palier de l'échelle de l'organisation aux trois étapes (brut, actuel, résiduel),
// décisions au regard de l'appétit, principaux risques. Testé : projet-synthese.test.ts.
import { cotations } from '@/lib/cotation-risque'
import { evaluateRisk, scaleSeuil, type EvaluationContext } from '@/lib/risque-priorisation'

export interface RisqueSynthese {
  id: string; nom: string; gravite: number; vraisemblance: number; niveauRisque: number
  graviteActuelle?: number | null; vraisemblanceActuelle?: number | null; niveauActuel?: number | null
  graviteResiduelle?: number | null; vraisemblanceResiduelle?: number | null
  taxonomieCode?: string | null; domaine?: string | null
}
export interface PalierSynthese { label: string; couleur: string; brut: number; actuel: number; residuel: number }

export function syntheseProjet(risques: readonly RisqueSynthese[], ctx: EvaluationContext) {
  const seuils = [...ctx.scale.seuilsMatrice].sort((a, b) => a.scoreMin - b.scoreMin)
  const paliers: PalierSynthese[] = seuils.map(s => ({ label: s.label, couleur: s.couleur, brut: 0, actuel: 0, residuel: 0 }))
  const compter = (g: number, v: number, etape: 'brut' | 'actuel' | 'residuel') => {
    const p = paliers.find(x => x.label === scaleSeuil(g, v, ctx.scale).label)
    if (p) p[etape]++
  }
  let aTraiter = 0
  for (const r of risques) {
    const c = cotations(r)
    compter(c.brut.g, c.brut.v, 'brut'); compter(c.actuel.g, c.actuel.v, 'actuel'); compter(c.residuel.g, c.residuel.v, 'residuel')
    if (evaluateRisk(r, ctx).decision === 'treat') aTraiter++
  }
  const niveauActuel = (r: RisqueSynthese) => { const c = cotations(r).actuel; return c.g * c.v }
  const principaux = [...risques].sort((a, b) => niveauActuel(b) - niveauActuel(a)).slice(0, 5)
    .map(r => ({ id: r.id, nom: r.nom, niveau: niveauActuel(r), domaine: r.domaine ?? null, palier: scaleSeuil(cotations(r).actuel.g, cotations(r).actuel.v, ctx.scale) }))
  return { total: risques.length, aTraiter, acceptables: risques.length - aTraiter, paliers, principaux }
}
