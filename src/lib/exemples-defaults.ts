/**
 * exemples-defaults.ts — Source unique des exemples par défaut « traduits ».
 *
 * Fusionne les données structurelles de `ebios-data` (types, scores, critères…)
 * avec les textes traduits de l'i18n (nom/description/impacts). Utilisé à la
 * fois par l'éditeur de configuration (pour pré-remplir) et par les ateliers
 * (pour l'affichage), garantissant que l'admin édite exactement ce que voit
 * l'utilisateur. Le repli override → défauts est géré par
 * `resolveExemples` (cf. exemples-ateliers.ts).
 */

import {
  VALEURS_METIER_EXEMPLES,
  BIENS_SUPPORTS_EXEMPLES,
  EVENEMENTS_REDOUTES_EXEMPLES,
} from '@/lib/ebios-data'
import type { ExempleCategoryKey } from '@/lib/exemples-ateliers'

/** Sous-ensemble des traductions nécessaire au calcul des défauts. */
export interface ExemplesTranslations {
  workshop: {
    a1: {
      vmExamples: { nom?: string; description?: string }[]
      bsExamples: { nom?: string; description?: string }[]
      erExamples: { description?: string; impacts?: string[] }[]
    }
  }
}

export function defaultExemplesFor(
  category: ExempleCategoryKey,
  t: ExemplesTranslations,
): Record<string, unknown>[] {
  const a1 = t?.workshop?.a1
  switch (category) {
    case 'valeursMetier':
      return VALEURS_METIER_EXEMPLES.map((v, i) => ({
        nom: a1?.vmExamples?.[i]?.nom ?? v.nom,
        type: v.type,
        description: a1?.vmExamples?.[i]?.description ?? v.description,
        disponibilite: v.disponibilite,
        integrite: v.integrite,
        confidentialite: v.confidentialite,
        tracabilite: v.tracabilite,
      }))
    case 'biensSupports':
      return BIENS_SUPPORTS_EXEMPLES.map((b, i) => ({
        nom: a1?.bsExamples?.[i]?.nom ?? b.nom,
        type: b.type,
        description: a1?.bsExamples?.[i]?.description ?? b.description,
      }))
    case 'evenementsRedoutes':
      return EVENEMENTS_REDOUTES_EXEMPLES.map((e, i) => ({
        description: a1?.erExamples?.[i]?.description ?? e.description,
        impacts: a1?.erExamples?.[i]?.impacts ?? e.impacts,
        graviteDefaut: e.graviteDefaut,
      }))
    default:
      return []
  }
}
