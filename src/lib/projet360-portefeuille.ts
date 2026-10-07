// ─── Portefeuille de projets 360 : carte de chaleur domaine × projet (PUR) ───────────────────────────────────────────
// Vue consolidée de tous les projets : par projet et par domaine, nombre de risques et niveau le plus élevé (résiduel s'il est
// coté, sinon brut), risques au-dessus de l'appétit. Réutilise les règles de `projet360.ts` (domaines, niveaux effectifs).
import { DOMAINES_360, isDomaine360, type Domaine360, type Risque360Lite } from './projet360'

export interface ProjetPortefeuilleInput { id: string; nom: string; statut: string; risques: Risque360Lite[] }
export interface CelluleDomaine { count: number; maxEffectif: number | null; auDessusAppetit: number }
export interface LignePortefeuille {
  id: string; nom: string; statut: string
  parDomaine: Record<Domaine360, CelluleDomaine>
  /** Risques sans domaine 360 reconnu (comptés dans les totaux du projet, pas dans une colonne). */
  nonClasses: number
  total: number
  auDessusAppetit: number
  maxEffectif: number | null
}
export interface Portefeuille360 {
  appetit: number | null
  projets: LignePortefeuille[]
  /** Projets triés : actifs les plus exposés d'abord, terminés / archivés en dernier. */
  projetsTries: LignePortefeuille[]
  totaux: Record<Domaine360, { count: number; auDessusAppetit: number; projetsExposes: number }>
}

const STATUTS_CLOS = ['TERMINE', 'ARCHIVE']
const effectif = (r: Risque360Lite) => r.niveauResiduel ?? r.niveauRisque
const cellule = (rs: Risque360Lite[], appetit: number | null): CelluleDomaine => ({
  count: rs.length,
  maxEffectif: rs.length ? Math.max(...rs.map(effectif)) : null,
  auDessusAppetit: appetit == null ? 0 : rs.filter(r => effectif(r) > appetit).length,
})

export function portefeuille360(projets: ProjetPortefeuilleInput[], appetit: number | null): Portefeuille360 {
  const lignes = projets.map((p): LignePortefeuille => {
    const parDomaine = Object.fromEntries(DOMAINES_360.map(d => [d, cellule(p.risques.filter(r => r.domaine === d), appetit)])) as Record<Domaine360, CelluleDomaine>
    const all = p.risques.map(effectif)
    return {
      id: p.id, nom: p.nom, statut: p.statut, parDomaine,
      nonClasses: p.risques.filter(r => !isDomaine360(r.domaine)).length,
      total: p.risques.length,
      auDessusAppetit: appetit == null ? 0 : all.filter(n => n > appetit).length,
      maxEffectif: all.length ? Math.max(...all) : null,
    }
  })
  const totaux = Object.fromEntries(DOMAINES_360.map(d => [d, {
    count: lignes.reduce((n, l) => n + l.parDomaine[d].count, 0),
    auDessusAppetit: lignes.reduce((n, l) => n + l.parDomaine[d].auDessusAppetit, 0),
    projetsExposes: lignes.filter(l => l.parDomaine[d].auDessusAppetit > 0).length,
  }])) as Portefeuille360['totaux']
  const clos = (l: LignePortefeuille) => STATUTS_CLOS.includes(l.statut)
  const projetsTries = [...lignes].sort((a, b) => Number(clos(a)) - Number(clos(b)) || b.auDessusAppetit - a.auDessusAppetit || (b.maxEffectif ?? -1) - (a.maxEffectif ?? -1) || a.nom.localeCompare(b.nom))
  return { appetit, projets: lignes, projetsTries, totaux }
}
