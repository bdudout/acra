/**
 * processus.ts — Référentiel de processus (socle GRC). Module PUR, testable.
 * Validation d'entrée, construction de l'arbre (macro-processus → processus) et
 * détection de cycle avant re-parentage.
 */

export interface ProcessusInput {
  nom?: string | null
  description?: string | null
  proprietaire?: string | null
  criticite?: number | null
  parentId?: string | null
  ordre?: number | null
  actif?: boolean
}

export type ProcessusInputError = 'nom_requis' | 'criticite_invalide'

/** Valide un processus AVANT écriture. Renvoie une clé d'erreur ou null. */
export function validateProcessusInput(input: ProcessusInput): ProcessusInputError | null {
  if (!input.nom?.trim()) return 'nom_requis'
  if (input.criticite != null) {
    const c = Number(input.criticite)
    if (!Number.isFinite(c) || c < 1 || c > 4) return 'criticite_invalide'
  }
  return null
}

/** Normalise les champs d'un processus (bornes de longueur, criticité 1-4|null). */
export function cleanProcessus(input: ProcessusInput): {
  nom: string; description: string | null; proprietaire: string | null
  criticite: number | null; parentId: string | null; ordre: number; actif: boolean
} {
  const c = input.criticite != null ? Math.round(Number(input.criticite)) : null
  return {
    nom: String(input.nom ?? '').trim().slice(0, 200),
    description: input.description != null ? String(input.description).slice(0, 2000) : null,
    proprietaire: input.proprietaire != null ? String(input.proprietaire).trim().slice(0, 200) || null : null,
    criticite: c != null && Number.isFinite(c) ? Math.max(1, Math.min(4, c)) : null,
    parentId: input.parentId?.trim() ? input.parentId.trim() : null,
    ordre: typeof input.ordre === 'number' && Number.isFinite(input.ordre) ? input.ordre : 0,
    actif: input.actif === false ? false : true,
  }
}

export interface ProcessusFlat { id: string; parentId?: string | null; ordre?: number | null }
export type ProcessusTree<T> = T & { enfants: ProcessusTree<T>[] }

/**
 * Construit l'arbre à partir de la liste plate. Les parents inexistants (orphelins)
 * sont remontés à la racine. Trié par `ordre` puis insertion. Pur.
 */
export function buildProcessusTree<T extends ProcessusFlat>(list: T[]): ProcessusTree<T>[] {
  const byId = new Map<string, ProcessusTree<T>>()
  for (const p of list) byId.set(p.id, { ...p, enfants: [] })
  const roots: ProcessusTree<T>[] = []
  for (const p of list) {
    const node = byId.get(p.id)!
    const parent = p.parentId ? byId.get(p.parentId) : null
    if (parent && parent !== node) parent.enfants.push(node)
    else roots.push(node)
  }
  const sortRec = (nodes: ProcessusTree<T>[]) => {
    nodes.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
    for (const n of nodes) sortRec(n.enfants)
  }
  sortRec(roots)
  return roots
}

/**
 * Vrai si re-parenter `id` sous `newParentId` créerait un cycle (le nouveau parent
 * est `id` lui-même ou l'un de ses descendants). Empêche les boucles d'arbre.
 */
export function wouldCreateCycle(list: ProcessusFlat[], id: string, newParentId: string | null): boolean {
  if (!newParentId) return false
  if (newParentId === id) return true
  const childrenOf = new Map<string, string[]>()
  for (const p of list) {
    if (!p.parentId) continue
    const arr = childrenOf.get(p.parentId) ?? []
    arr.push(p.id); childrenOf.set(p.parentId, arr)
  }
  // newParentId est-il un descendant de id ?
  const stack = [id]
  const seen = new Set<string>()
  while (stack.length) {
    const cur = stack.pop()!
    for (const child of childrenOf.get(cur) ?? []) {
      if (child === newParentId) return true
      if (!seen.has(child)) { seen.add(child); stack.push(child) }
    }
  }
  return false
}
