/**
 * exemples-patterns.ts — Agrégat du contenu des patterns d'architecture de SI et exemples localisés par catégorie
 * (voir exemples-patterns-core.ts pour les types, constructeurs et la sélection ; un module de contenu par famille).
 */
import type { Locale } from '@/lib/i18n'
import type { SecteurFamille } from '@/lib/sous-secteurs'
import { localizePatternItem, selectPatternItems, type PatternCategory, type PatternItem } from '@/lib/exemples-patterns-core'
import { EXPOSITION_ITEMS } from '@/lib/exemples-patterns-exposition'
import { INTERCO_ITEMS } from '@/lib/exemples-patterns-interco'
import { ADMIN_POSTES_ITEMS } from '@/lib/exemples-patterns-admin-postes'
import { COMPLEMENT_ITEMS } from '@/lib/exemples-patterns-complements'
import { LOT2_ITEMS } from '@/lib/exemples-patterns-lot2'

export { selectPatternItems, localizePatternItem, type PatternItem, type PatternCategory } from '@/lib/exemples-patterns-core'

export const PATTERN_ITEMS: readonly PatternItem[] = [...EXPOSITION_ITEMS, ...INTERCO_ITEMS, ...ADMIN_POSTES_ITEMS, ...COMPLEMENT_ITEMS, ...LOT2_ITEMS]

/**
 * Plafond d'exemples proposés par pattern et par catégorie (les combinaisons, rares et ciblées, s'ajoutent) : le
 * contenu est rangé du plus utile au moins utile, on ne garde que la tête pour ne pas surcharger l'atelier.
 */
export const MAX_EXEMPLES_PAR_PATTERN = 4
/** Plafond global d'exemples « architecture » par catégorie, quel que soit le nombre de patterns cochés. */
export const MAX_EXEMPLES_ARCHITECTURE = 10

/**
 * Exemples des patterns cochés, localisés, avec les patterns qui les justifient (badge « votre architecture »).
 * Ordre : combinaisons (les plus ciblées), puis entrelacement — le 1er exemple de chaque pattern, puis le 2e… — pour
 * que chaque pattern coché soit représenté avant le plafond global.
 */
export function patternExemplesTagged(patterns: readonly string[] | null | undefined, category: PatternCategory, locale: Locale = 'fr', famille: SecteurFamille | null = null): { item: Record<string, unknown>; patterns: readonly string[] }[] {
  if (!patterns?.length) return []
  const selected = selectPatternItems(PATTERN_ITEMS, patterns, category, famille)
  const combos = selected.filter(i => i.patterns.length > 1)
  const files = patterns.map(code => selected.filter(i => i.patterns.length === 1 && i.patterns[0] === code).slice(0, MAX_EXEMPLES_PAR_PATTERN))
  const ordered: PatternItem[] = [...combos]
  for (let rang = 0; rang < MAX_EXEMPLES_PAR_PATTERN; rang++) for (const f of files) if (f[rang]) ordered.push(f[rang])
  return ordered.slice(0, MAX_EXEMPLES_ARCHITECTURE).map(i => ({ item: localizePatternItem(i, locale), patterns: i.patterns }))
}

/** Exemples localisés des patterns cochés pour une catégorie d'atelier. */
export function patternExemplesFor(patterns: readonly string[] | null | undefined, category: PatternCategory, locale: Locale = 'fr', famille: SecteurFamille | null = null): Record<string, unknown>[] {
  return patternExemplesTagged(patterns, category, locale, famille).map(t => t.item)
}
