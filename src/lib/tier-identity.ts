// ─── Identité canonique d'un tiers : validation, rapprochement proposé, couverture (PUR) ──────────────────────────────────
// Un `Tier` représente UNE personne morale du groupe. Le rapprochement n'est jamais décidé par le code : un LEI identique est un
// candidat FORT, un nom ou un alias identique (forme juridique ignorée) un candidat FAIBLE à revoir ; un nom seul ne prouve rien.

import { normalizeTierName } from './tiers'

export interface TierLite { id: string; nom: string; lei: string | null; pays?: string | null; aliases: string[] }
export type CandidateReason = 'LEI' | 'NAME' | 'ALIAS'
export interface TierCandidate { tierId: string; reason: CandidateReason; strength: 'STRONG' | 'WEAK' }
export type TierCoverage = 'CYBER_ONLY' | 'TIC_ONLY' | 'CYBER_AND_TIC' | 'UNUSED'

export const MAX_TIER_NAME = 200
const LEGAL_FORMS = new Set(['sa', 'sas', 'sarl', 'inc', 'ltd', 'llc', 'gmbh', 'corp', 'ag', 'spa', 'srl', 'bv', 'nv', 'plc', 'se'])

/** LEI normalisé : 20 caractères alphanumériques en majuscules ; `null` sinon. */
export function normalizeLei(value: unknown): string | null {
  const v = String(value ?? '').replace(/\s+/g, '').toUpperCase()
  return /^[A-Z0-9]{20}$/.test(v) ? v : null
}

/** Nom comparable : accents, casse, ponctuation et forme juridique ignorés (« Société Générale SA » = « societe generale »). */
export function comparableTierName(nom: string): string {
  return normalizeTierName(nom).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t && !LEGAL_FORMS.has(t)).join(' ')
}

/** Candidats de rapprochement parmi `tiers` : fort (LEI) d'abord, puis faibles (nom, alias). Un LEI différent écarte le nom. */
export function findTierCandidates(input: { nom: string; lei?: string | null }, tiers: TierLite[]): TierCandidate[] {
  const lei = normalizeLei(input.lei)
  const name = comparableTierName(input.nom)
  const out: TierCandidate[] = []
  for (const tier of tiers) {
    const tierLei = normalizeLei(tier.lei)
    if (lei && tierLei && lei === tierLei) { out.push({ tierId: tier.id, reason: 'LEI', strength: 'STRONG' }); continue }
    if (lei && tierLei && lei !== tierLei) continue // deux identifiants différents : deux personnes morales
    if (!name) continue
    if (comparableTierName(tier.nom) === name) out.push({ tierId: tier.id, reason: 'NAME', strength: 'WEAK' })
    else if (tier.aliases.some(alias => comparableTierName(alias) === name)) out.push({ tierId: tier.id, reason: 'ALIAS', strength: 'WEAK' })
  }
  return out.sort((a, b) => (a.strength === b.strength ? 0 : a.strength === 'STRONG' ? -1 : 1))
}

export function classifyTierCoverage(use: { cyber: boolean; tic: boolean }): TierCoverage {
  return use.cyber && use.tic ? 'CYBER_AND_TIC' : use.cyber ? 'CYBER_ONLY' : use.tic ? 'TIC_ONLY' : 'UNUSED'
}

export type TierInputError = 'nom_requis' | 'nom_trop_long' | 'lei_invalide' | 'pays_invalide'
export function cleanTierInput(body: { nom?: unknown; lei?: unknown; pays?: unknown; aliases?: unknown }):
  { ok: true; value: { nom: string; lei: string | null; pays: string | null; aliases: string[] } } | { ok: false; error: TierInputError } {
  const nom = String(body.nom ?? '').trim()
  if (!nom) return { ok: false, error: 'nom_requis' }
  if (nom.length > MAX_TIER_NAME) return { ok: false, error: 'nom_trop_long' }
  const rawLei = String(body.lei ?? '').trim()
  const lei = rawLei ? normalizeLei(rawLei) : null
  if (rawLei && !lei) return { ok: false, error: 'lei_invalide' }
  const rawPays = String(body.pays ?? '').trim().toUpperCase()
  if (rawPays && !/^[A-Z]{2}$/.test(rawPays)) return { ok: false, error: 'pays_invalide' }
  const seen = new Set<string>(); const aliases: string[] = []
  for (const a of Array.isArray(body.aliases) ? body.aliases : []) {
    const alias = String(a ?? '').trim()
    if (!alias || alias.length > MAX_TIER_NAME || seen.has(alias.toLowerCase())) continue
    seen.add(alias.toLowerCase()); aliases.push(alias)
    if (aliases.length >= 20) break
  }
  return { ok: true, value: { nom, lei, pays: rawPays || null, aliases } }
}

/** Racine du groupe d'après le chemin matérialisé `/racine/…/id/` ; une organisation sans chemin est sa propre racine. */
export function rootOrganizationIdOf(path: string | null | undefined, organizationId: string): string {
  const first = (path ?? '').split('/').filter(Boolean)[0]
  return first || organizationId
}
