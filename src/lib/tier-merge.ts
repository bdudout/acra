// ─── Fusion de deux identités de tiers en doublon (règles PURES) ──────────────────────────────────────────────────────────
// Jamais automatique, jamais au détriment d'une autre organisation : la fusion n'est permise que si les données à déplacer
// appartiennent toutes à l'organisation qui la demande ; sinon elle relève de l'ADMINISTRATEUR DU GROUPE (organisation racine), qui
// décide pour toutes les filiales (accès, contrats, parties prenantes et usages sont alors tous repris par l'identité conservée).

import { comparableTierName, MAX_TIER_NAME, normalizeLei } from './tier-identity'

export interface MergeSide { id: string; lei: string | null; root: string }
export interface MergeExposure { otherOrganizations: number; foreignArrangements: number; foreignParties: number; foreignUsages: number }
export type MergeError = 'same_tier' | 'different_group' | 'lei_conflict' | 'shared_with_other_organizations'

/** Vrai si l'organisation active est la RACINE du groupe des deux identités et que l'utilisateur y est ADMIN : la fusion peut alors toucher les filiales. */
export function isGroupAdminMerge(actor: { isAdmin: boolean; orgId: string }, source: MergeSide, target: MergeSide): boolean {
  return actor.isAdmin && source.root === actor.orgId && target.root === actor.orgId
}

export function planTierMerge(source: MergeSide, target: MergeSide, exposure: MergeExposure, opts: { groupAdmin?: boolean } = {}): { ok: true } | { ok: false; error: MergeError } {
  if (source.id === target.id) return { ok: false, error: 'same_tier' }
  if (source.root !== target.root) return { ok: false, error: 'different_group' }
  const a = normalizeLei(source.lei); const b = normalizeLei(target.lei)
  if (a && b && a !== b) return { ok: false, error: 'lei_conflict' }
  if (!opts.groupAdmin && (exposure.otherOrganizations || exposure.foreignArrangements || exposure.foreignParties || exposure.foreignUsages)) return { ok: false, error: 'shared_with_other_organizations' }
  return { ok: true }
}

/** Alias du tiers conservé après fusion : ses alias, puis le nom et les alias absorbés ; sans doublon ni alias équivalent à son nom. */
export function mergeAliases(target: { nom: string; aliases: string[] }, source: { nom: string; aliases: string[] }): string[] {
  const seen = new Set([comparableTierName(target.nom)])
  const out: string[] = []
  for (const raw of [...target.aliases, source.nom, ...source.aliases]) {
    const alias = String(raw ?? '').trim()
    const key = comparableTierName(alias)
    if (!alias || !key || alias.length > MAX_TIER_NAME || seen.has(key)) continue
    seen.add(key); out.push(alias)
    if (out.length >= 20) break
  }
  return out
}
