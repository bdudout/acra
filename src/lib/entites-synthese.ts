// ─── Synthèse par entité des tableaux de bord (consolidation des entités) — PUR ─
// Répartit des objets (risques, incidents, actions…) sur les entités ACTIVES du référentiel : chaque entité cumule ses
// objets et ceux de ses sous-entités, dans l'ordre de l'arbre ; les objets sans entité (ou d'une entité close) sont
// « non rattachés ». Rattachement d'un objet : lien `entiteId`, à défaut texte libre identique (lib/entites-filtre).
import { estActive, type EntiteRef } from './entites'
import { optionsEntites, resoudreEntite } from './entites-filtre'
import { rollupRisks, type RiskLite, type RiskTotals } from './grc-rollup'
import { rollupIncidents, type CockpitIncident, type IncidentTotals } from './grc-cockpit'
import { summarizeActions, type ActionLike } from './risk-action'

export interface LigneRepartition<T> { id: string; nom: string; niveau: number; items: T[] }

export function repartirParEntite<T>(entites: EntiteRef[], items: T[], lien: (x: T) => { entiteId?: string | null; entite?: string | null }): { lignes: LigneRepartition<T>[]; nonRattaches: T[] } {
  const toutes = new Map(entites.map(e => [e.id, e]))
  const actives = new Map(entites.filter(e => estActive(e)).map(e => [e.id, e]))
  const parEntite = new Map<string, T[]>()
  const nonRattaches: T[] = []
  for (const it of items) {
    const l = lien(it)
    const id = resoudreEntite(l.entiteId, l.entite, entites)
    if (!id || !actives.has(id)) { nonRattaches.push(it); continue }
    // L'objet compte pour son entité et pour chacun de ses ancêtres actifs (un ancêtre clos est traversé).
    const vus = new Set<string>()
    for (let e = toutes.get(id); e && !vus.has(e.id); e = e.parentId ? toutes.get(e.parentId) : undefined) {
      vus.add(e.id)
      if (actives.has(e.id)) parEntite.set(e.id, [...(parEntite.get(e.id) ?? []), it])
    }
  }
  return { lignes: optionsEntites(entites).map(o => ({ ...o, items: parEntite.get(o.id) ?? [] })), nonRattaches }
}

type Lien = { entiteId?: string | null; entite?: string | null }
export interface LigneSynthese { id: string; nom: string; niveau: number; risques: RiskTotals; actionsEnRetard: number; incidents?: IncidentTotals }

/** Indicateurs des tableaux de bord par entité (sous-entités cumulées) : paliers des risques, actions de ces risques en
 *  retard, incidents (base de pertes) si le module est actif. Les entités sans aucun objet sont omises. */
export function syntheseParEntite(o: {
  entites: EntiteRef[]; now: Date
  risques: (RiskLite & Lien & { id: string })[]
  actions: (ActionLike & { risqueId: string })[]
  incidents?: (CockpitIncident & Lien)[]
}): { lignes: LigneSynthese[]; nonRattache: Omit<LigneSynthese, 'id' | 'nom' | 'niveau'> } {
  const actionsDe = new Map<string, ActionLike[]>()
  for (const a of o.actions) actionsDe.set(a.risqueId, [...(actionsDe.get(a.risqueId) ?? []), a])
  const r = repartirParEntite(o.entites, o.risques, x => x)
  const inc = o.incidents ? repartirParEntite(o.entites, o.incidents, x => x) : null
  const indicateurs = (risques: typeof o.risques, incidents?: (CockpitIncident & Lien)[]) => ({
    risques: rollupRisks(risques),
    actionsEnRetard: summarizeActions(risques.flatMap(x => actionsDe.get(x.id) ?? []), o.now).enRetard,
    ...(incidents ? { incidents: rollupIncidents(incidents) } : {}),
  })
  const lignes = r.lignes.map((l, i) => ({ id: l.id, nom: l.nom, niveau: l.niveau, ...indicateurs(l.items, inc?.lignes[i].items) }))
    .filter(l => l.risques.total > 0 || (l.incidents?.total ?? 0) > 0)
  return { lignes, nonRattache: indicateurs(r.nonRattaches, inc?.nonRattaches) }
}
