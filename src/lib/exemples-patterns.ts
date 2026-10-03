/**
 * exemples-patterns.ts — Agrégat du contenu des patterns d'architecture de SI et exemples localisés par catégorie
 * (voir exemples-patterns-core.ts pour les types, constructeurs et la sélection ; un module de contenu par famille).
 */
import type { Locale } from '@/lib/i18n'
import type { SecteurFamille } from '@/lib/sous-secteurs'
import { localizePatternItem, selectPatternItems, type PatternCategory, type PatternItem } from '@/lib/exemples-patterns-core'
import { EXPOSITION_ITEMS } from '@/lib/exemples-patterns-exposition'

export { selectPatternItems, localizePatternItem, type PatternItem, type PatternCategory } from '@/lib/exemples-patterns-core'

export const PATTERN_ITEMS: readonly PatternItem[] = [...EXPOSITION_ITEMS]

/** Exemples localisés des patterns cochés pour une catégorie d'atelier. */
export function patternExemplesFor(patterns: readonly string[] | null | undefined, category: PatternCategory, locale: Locale = 'fr', famille: SecteurFamille | null = null): Record<string, unknown>[] {
  if (!patterns?.length) return []
  return selectPatternItems(PATTERN_ITEMS, patterns, category, famille).map(i => localizePatternItem(i, locale))
}
