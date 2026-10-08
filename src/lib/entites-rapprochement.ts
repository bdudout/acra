// ─── Rapprochement des textes libres « entité » (consolidation, lot E3) — PUR ──────────────────────────────────────────
// Les champs `entite` en texte libre (risques, incidents, suivis de conformité, plans d'action, traitements, mesures) sont
// regroupés par valeur distincte ; chaque valeur reçoit une proposition d'entité du référentiel (exacte, proche ou aucune).
// L'administrateur valide par lot : lien vers une entité (la variante d'écriture devient un alias) ou création d'une
// entité à partir de la valeur. Le texte d'origine est conservé. Spec : docs/specs/entites-consolidation-besoin.md (§ 2.4).
import { correspondances, estActive, normaliserNom, TYPES_ENTITE, type Correspondance, type EntiteRef, type TypeEntite } from './entites'

export const SOURCES_TEXTE = ['risques', 'incidents', 'conformites', 'plansAction', 'traitementsConformite', 'mesures'] as const
export type SourceTexte = (typeof SOURCES_TEXTE)[number]

export interface ValeurLibre { valeur: string; total: number; occurrences: Partial<Record<SourceTexte, number>>; brutes: string[] }
export interface Proposition extends ValeurLibre { niveau: 'EXACTE' | 'PROCHE' | 'AUCUNE'; suggestion?: Correspondance; autres: Correspondance[] }

/** Valeurs distinctes (espaces, casse et accents ignorés), vides ignorées, de la plus fréquente à la moins fréquente ;
 *  le libellé affiché est la variante d'écriture la plus fréquente. */
export function regrouperValeurs(lignes: { source: SourceTexte; valeur: string | null; n: number }[]): ValeurLibre[] {
  const parCle = new Map<string, ValeurLibre & { variantes: Map<string, number> }>()
  for (const l of lignes) {
    const propre = (l.valeur ?? '').trim().replace(/\s+/g, ' ')
    const cle = normaliserNom(propre)
    if (!cle) continue
    const v = parCle.get(cle) ?? { valeur: propre, total: 0, occurrences: {}, brutes: [], variantes: new Map<string, number>() }
    v.total += l.n
    v.occurrences[l.source] = (v.occurrences[l.source] ?? 0) + l.n
    if (!v.brutes.includes(l.valeur!)) v.brutes.push(l.valeur!)
    v.variantes.set(propre, (v.variantes.get(propre) ?? 0) + l.n)
    parCle.set(cle, v)
  }
  return [...parCle.values()].map(({ variantes, ...v }) => {
    let valeur = v.valeur, max = -1
    for (const [x, n] of variantes) if (n > max) { valeur = x; max = n }
    return { ...v, valeur }
  }).sort((a, b) => b.total - a.total || a.valeur.localeCompare(b.valeur))
}

/** Proposition pour chaque valeur, parmi les entités actives seulement. */
export function proposerRapprochements(valeurs: ValeurLibre[], entites: EntiteRef[]): Proposition[] {
  const actives = entites.filter(e => estActive(e))
  return valeurs.map(v => {
    const c = correspondances(v.valeur, actives)
    const suggestion = c[0]
    return { ...v, niveau: !suggestion ? 'AUCUNE' : suggestion.score >= 1 ? 'EXACTE' : 'PROCHE', suggestion, autres: c.slice(1, 4) }
  })
}

export type Decision = { valeur: string; entiteId: string } | { valeur: string; creer: string }
export interface PlanRapprochement {
  erreur?: 'valeur_inconnue' | 'entite_invalide' | 'type_invalide'
  liens: { brutes: string[]; entiteId: string }[]
  creations: { nom: string; type: TypeEntite; brutes: string[] }[]
  /** Variantes d'écriture ajoutées en alias, par entité. */
  aliasAjoutes: Record<string, string[]>
}

export function planifierRapprochement(decisions: Decision[], propositions: ValeurLibre[], entites: EntiteRef[]): PlanRapprochement {
  const plan: PlanRapprochement = { liens: [], creations: [], aliasAjoutes: {} }
  const parValeur = new Map(propositions.map(p => [p.valeur, p]))
  const actives = new Map(entites.filter(e => estActive(e)).map(e => [e.id, e]))
  for (const d of decisions) {
    const v = parValeur.get(d.valeur)
    if (!v) return { ...plan, erreur: 'valeur_inconnue' }
    if ('creer' in d) {
      if (!TYPES_ENTITE.includes(d.creer as TypeEntite)) return { ...plan, erreur: 'type_invalide' }
      plan.creations.push({ nom: v.valeur, type: d.creer as TypeEntite, brutes: v.brutes })
      continue
    }
    const e = actives.get(d.entiteId)
    if (!e) return { ...plan, erreur: 'entite_invalide' }
    plan.liens.push({ brutes: v.brutes, entiteId: e.id })
    const connus = new Set([e.nom, ...e.alias, ...(plan.aliasAjoutes[e.id] ?? [])].map(normaliserNom))
    if (!connus.has(normaliserNom(v.valeur))) (plan.aliasAjoutes[e.id] ??= []).push(v.valeur)
  }
  return plan
}
