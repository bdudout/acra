// ─── Fusion de deux identités de tiers en doublon (règles PURES) ──────────────────────────────────────────────────────────
// Jamais automatique, jamais au détriment d'une autre organisation : la fusion n'est permise que si les données à déplacer
// appartiennent toutes à l'organisation qui la demande (sinon, elle relève de l'administrateur du groupe).

import { comparableTierName, MAX_TIER_NAME, normalizeLei } from './tier-identity'

export interface MergeSide { id: string; lei: string | null; root: string }
export interface MergeExposure { otherOrganizations: number; foreignArrangements: number; foreignParties: number; foreignUsages: number }
export type MergeError = 'same_tier' | 'different_group' | 'lei_conflict' | 'shared_with_other_organizations'

export function planTierMerge(source: MergeSide, target: MergeSide, exposure: MergeExposure): { ok: true } | { ok: false; error: MergeError } {
  if (source.id === target.id) return { ok: false, error: 'same_tier' }
  if (source.root !== target.root) return { ok: false, error: 'different_group' }
  const a = normalizeLei(source.lei); const b = normalizeLei(target.lei)
  if (a && b && a !== b) return { ok: false, error: 'lei_conflict' }
  if (exposure.otherOrganizations || exposure.foreignArrangements || exposure.foreignParties || exposure.foreignUsages) return { ok: false, error: 'shared_with_other_organizations' }
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
