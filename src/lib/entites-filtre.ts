// ─── Filtre et sélecteur d'entité (consolidation, lot E5) — PUR ───────────────
// Rattache un objet à une entité du référentiel (lien `entiteId`, à défaut texte libre identique au nom ou à un alias),
// calcule le périmètre d'une entité (sous-entités comprises) et filtre une liste d'objets. Sert aux listes d'incidents
// et de plans d'action, et au sélecteur d'entité des formulaires. Spec : docs/specs/entites-consolidation-besoin.md.
import { construireArbre, correspondances, estActive, type EntiteRef, type NoeudEntite } from './entites'

/** Entité d'un objet : son lien, sinon une correspondance identique de son texte libre (jamais une simple proximité). */
export function resoudreEntite(entiteId: string | null | undefined, texte: string | null | undefined, entites: EntiteRef[]): string | null {
  if (entiteId) return entiteId
  if (!texte?.trim()) return null
  return correspondances(texte, entites, 1)[0]?.id ?? null
}

export function perimetreEntite(entites: Pick<EntiteRef, 'id' | 'parentId'>[], id: string, sousEntites: boolean): Set<string> {
  const out = new Set([id])
  if (!sousEntites) return out
  const pile = [id]
  while (pile.length) {
    const p = pile.pop()!
    for (const e of entites) if (e.parentId === p && !out.has(e.id)) { out.add(e.id); pile.push(e.id) }
  }
  return out
}

export function filtrerParEntite<T extends { entiteId?: string | null; entite?: string | null }>(items: T[], entites: EntiteRef[], id: string, sousEntites: boolean): T[] {
  if (!id) return items
  const perimetre = perimetreEntite(entites, id, sousEntites)
  return items.filter(it => { const e = resoudreEntite(it.entiteId, it.entite, entites); return !!e && perimetre.has(e) })
}

/** Options d'un sélecteur : entités actives, dans l'ordre de l'arbre, avec leur niveau d'indentation. */
export function optionsEntites(entites: EntiteRef[]): { id: string; nom: string; niveau: number }[] {
  const out: { id: string; nom: string; niveau: number }[] = []
  const parcourir = (n: NoeudEntite, niveau: number) => { out.push({ id: n.entite.id, nom: n.entite.nom, niveau }); n.enfants.forEach(c => parcourir(c, niveau + 1)) }
  construireArbre(entites.filter(e => estActive(e))).forEach(n => parcourir(n, 0))
  return out
}
