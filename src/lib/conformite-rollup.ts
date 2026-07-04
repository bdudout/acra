/**
 * conformite-rollup.ts — Agrégation de la conformité sur l'arbre d'organisations
 * (Palier 3, dashboard global). Module PUR → testé unitairement.
 *
 * Chaque organisation porte une conformité par référentiel (entité Conformite).
 * Le roll-up « met en commun » (pool) les évaluations du SOUS-ARBRE d'une
 * organisation (elle-même + ses descendants, via le chemin matérialisé `path`) :
 * une direction agrège ses entités, un groupe agrège ses directions, etc.
 *
 * Taux mis en commun = conforme / (conforme + partiel + non_conforme) × 100.
 */

export interface RollupOrg { id: string; path: string }

export interface RollupConfInput {
  organizationId: string
  referentiel: string
  conforme: number
  partiel: number
  nonConforme: number
  na: number
  total: number
}

export interface RollupCell {
  conforme: number
  partiel: number
  nonConforme: number
  na: number
  evalues: number
  /** Nombre total de contrôles du référentiel (le référentiel étant commun). */
  total: number
  /** Taux de conformité mis en commun (%). */
  taux: number
  /** Nombre d'organisations du sous-arbre contribuant à ce référentiel. */
  orgCount: number
}

/**
 * Pour chaque organisation, agrège (pool) la conformité de son sous-arbre par
 * référentiel. Renvoie `{ [orgId]: { [referentiel]: RollupCell } }`.
 * Une organisation est dans le sous-arbre de O si `path` commence par `O.path`.
 */
export function rollupConformiteTree(
  orgs: RollupOrg[],
  cells: RollupConfInput[],
): Record<string, Record<string, RollupCell>> {
  const byOrgId = new Map(orgs.map(o => [o.id, o]))
  // Cellules groupées par organisation, avec le path de l'org (pour le préfixe).
  const cellsWithPath = cells
    .map(c => ({ ...c, path: byOrgId.get(c.organizationId)?.path }))
    .filter((c): c is RollupConfInput & { path: string } => typeof c.path === 'string')

  const out: Record<string, Record<string, RollupCell>> = {}
  for (const o of orgs) {
    const sub = cellsWithPath.filter(c => c.path.startsWith(o.path))
    const byRef: Record<string, RollupCell & { _orgs: Set<string> }> = {}
    for (const c of sub) {
      const cell = byRef[c.referentiel] ?? (byRef[c.referentiel] = {
        conforme: 0, partiel: 0, nonConforme: 0, na: 0, evalues: 0, total: 0, taux: 0, orgCount: 0, _orgs: new Set<string>(),
      })
      cell.conforme += c.conforme
      cell.partiel += c.partiel
      cell.nonConforme += c.nonConforme
      cell.na += c.na
      cell.total = Math.max(cell.total, c.total)
      cell._orgs.add(c.organizationId)
    }
    const refs: Record<string, RollupCell> = {}
    for (const [ref, cell] of Object.entries(byRef)) {
      const pertinents = cell.conforme + cell.partiel + cell.nonConforme
      refs[ref] = {
        conforme: cell.conforme, partiel: cell.partiel, nonConforme: cell.nonConforme, na: cell.na,
        evalues: cell.conforme + cell.partiel + cell.nonConforme + cell.na,
        total: cell.total,
        taux: pertinents > 0 ? Math.round((cell.conforme / pertinents) * 100) : 0,
        orgCount: cell._orgs.size,
      }
    }
    out[o.id] = refs
  }
  return out
}
