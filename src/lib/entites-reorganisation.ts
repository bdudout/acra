// ─── Réorganisations du référentiel des entités (consolidation, lot E4) — PUR ─────────────────────────────────────────
// Renommer, fusionner (A + B → C ou B absorbe A), scinder (A → B + C, A conservée ou close), clore (avec ou sans
// successeur). Chaque opération est datée ; les références (risques, incidents, plans…) et les sous-entités des entités
// closes passent à leur successeur ; l'événement garde la liste des objets déplacés pour répondre à « à quelle entité cet
// objet appartenait-il à telle date ? » (historique conservé 5 ans). Spec : docs/specs/entites-consolidation-besoin.md.
import { estActive, NOM_MAX, normaliserNom, TYPES_ENTITE, type EntiteRef, type TypeEntite } from './entites'
import type { SourceTexte } from './entites-rapprochement'

export const TYPES_REORGANISATION = ['RENOMMAGE', 'FUSION', 'SCISSION', 'CLOTURE'] as const
export type TypeReorganisation = (typeof TYPES_REORGANISATION)[number]

type NouvelleEntite = { nom: string; type: string }
export type OperationReorganisation = { dateEffet: string } & (
  | { type: 'RENOMMAGE'; sources: string[]; nouveauNom: string }
  | { type: 'FUSION'; sources: string[]; cible: { id: string } | NouvelleEntite }
  | { type: 'SCISSION'; sources: string[]; nouvelles: NouvelleEntite[]; repreneur: number | null }
  | { type: 'CLOTURE'; sources: string[]; successeur?: string | null }
)

/** Destination : entité existante ou entité créée par l'opération (indice dans `creations`). */
export type Destination = { id: string } | { creation: number }
export interface PlanReorganisation {
  ok: true
  type: TypeReorganisation
  dateEffet: Date
  renommage?: { id: string; nom: string; alias: string[] }
  creations: { nom: string; type: TypeEntite; parentId: string | null; alias: string[] }[]
  /** Références (objets rattachés) déplacées de `de` vers `vers`. */
  transferts: { de: string; vers: Destination }[]
  /** Sous-entités rattachées à `de` déplacées vers `vers`. */
  sousEntites: { de: string; vers: Destination }[]
  clore: string[]
  aliasAjoutes: Record<string, string[]>
}
export type ErreurReorganisation = 'date_invalide' | 'source_invalide' | 'sources_insuffisantes' | 'cible_invalide' | 'nom_requis' | 'type_invalide' | 'nouvelles_requises' | 'repreneur_invalide'

function nouvelle(n: NouvelleEntite): { nom: string; type: TypeEntite } | ErreurReorganisation {
  const nom = (n.nom ?? '').trim().replace(/\s+/g, ' ').slice(0, NOM_MAX)
  if (!nom) return 'nom_requis'
  if (!TYPES_ENTITE.includes(n.type as TypeEntite)) return 'type_invalide'
  return { nom, type: n.type as TypeEntite }
}

function descendants(entites: EntiteRef[], id: string): Set<string> {
  const out = new Set<string>(); const pile = [id]
  while (pile.length) { const p = pile.pop()!; for (const e of entites) if (e.parentId === p && !out.has(e.id)) { out.add(e.id); pile.push(e.id) } }
  return out
}

export function planifierReorganisation(op: OperationReorganisation, entites: EntiteRef[]): PlanReorganisation | { ok: false; error: ErreurReorganisation } {
  const ko = (error: ErreurReorganisation) => ({ ok: false as const, error })
  const dateEffet = new Date(op.dateEffet)
  if (!op.dateEffet || Number.isNaN(dateEffet.getTime())) return ko('date_invalide')
  const actives = new Map(entites.filter(e => estActive(e)).map(e => [e.id, e]))
  const sources = [...new Set(op.sources ?? [])].map(id => actives.get(id))
  if (!sources.length || sources.some(s => !s)) return ko('source_invalide')
  const src = sources as EntiteRef[]
  const plan: PlanReorganisation = { ok: true, type: op.type, dateEffet, creations: [], transferts: [], sousEntites: [], clore: [], aliasAjoutes: {} }
  // Une destination existante doit être active et hors des sous-entités des entités qui ferment (pas de boucle).
  const destinationValide = (id: string, fermees: EntiteRef[]) => actives.has(id) && !fermees.some(f => f.id === id || descendants(entites, f.id).has(id))
  const transferer = (de: EntiteRef, vers: Destination) => { plan.transferts.push({ de: de.id, vers }); plan.sousEntites.push({ de: de.id, vers }); plan.clore.push(de.id) }

  switch (op.type) {
    case 'RENOMMAGE': {
      const nom = (op.nouveauNom ?? '').trim().replace(/\s+/g, ' ').slice(0, NOM_MAX)
      if (!nom) return ko('nom_requis')
      const e = src[0]
      const alias = normaliserNom(e.nom) === normaliserNom(nom) || e.alias.some(a => normaliserNom(a) === normaliserNom(e.nom)) ? e.alias : [...e.alias, e.nom]
      plan.renommage = { id: e.id, nom, alias }
      return plan
    }
    case 'FUSION': {
      if (src.length < 2) return ko('sources_insuffisantes')
      if ('id' in op.cible) {
        const cibleId = op.cible.id
        const fermees = src.filter(s => s.id !== cibleId)
        if (!destinationValide(cibleId, fermees)) return ko('cible_invalide')
        for (const s of fermees) transferer(s, { id: cibleId })
        const cible = actives.get(cibleId)!
        const connus = new Set([cible.nom, ...cible.alias].map(normaliserNom))
        const ajouts = fermees.map(s => s.nom).filter(n => !connus.has(normaliserNom(n)))
        if (ajouts.length) plan.aliasAjoutes[cibleId] = ajouts
        return plan
      }
      const n = nouvelle(op.cible)
      if (typeof n === 'string') return ko(n)
      // Rattachement commun des sources s'il existe, sinon racine.
      const parents = new Set(src.map(s => s.parentId))
      plan.creations.push({ ...n, parentId: parents.size === 1 ? src[0].parentId : null, alias: src.map(s => s.nom).filter(x => normaliserNom(x) !== normaliserNom(n.nom)) })
      for (const s of src) transferer(s, { creation: 0 })
      return plan
    }
    case 'SCISSION': {
      if (src.length !== 1) return ko('source_invalide')
      if (!op.nouvelles?.length) return ko('nouvelles_requises')
      const e = src[0]
      for (const x of op.nouvelles) {
        const n = nouvelle(x)
        if (typeof n === 'string') return ko(n)
        plan.creations.push({ ...n, parentId: e.parentId, alias: [] })
      }
      if (op.repreneur === null || op.repreneur === undefined) return plan // essaimage : la source reste
      if (!Number.isInteger(op.repreneur) || op.repreneur < 0 || op.repreneur >= plan.creations.length) return ko('repreneur_invalide')
      transferer(e, { creation: op.repreneur })
      return plan
    }
    case 'CLOTURE': {
      if (src.length !== 1) return ko('source_invalide')
      const e = src[0]
      if (!op.successeur) { plan.clore.push(e.id); return plan }
      if (!destinationValide(op.successeur, [e])) return ko('cible_invalide')
      transferer(e, { id: op.successeur })
      return plan
    }
  }
  return ko('type_invalide')
}

/** Objets déplacés par un événement : { idEntitéSource: { risques: [ids], … } }. */
export interface Evenement { dateEffet: Date; objets: Record<string, Partial<Record<SourceTexte, string[]>>> }

/** Entité de rattachement d'un objet à une date : on remonte les transferts postérieurs à cette date. */
export function entiteALaDate(entiteActuelle: string | null, source: SourceTexte, objetId: string, evenements: Evenement[], date: Date): string | null {
  let entite = entiteActuelle
  const posterieurs = evenements.filter(e => e.dateEffet > date).sort((a, b) => b.dateEffet.getTime() - a.dateEffet.getTime())
  for (const ev of posterieurs) {
    for (const [de, parSource] of Object.entries(ev.objets)) if (parSource[source]?.includes(objetId)) { entite = de; break }
  }
  return entite
}
