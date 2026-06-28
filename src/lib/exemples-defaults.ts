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

import { getEbiosData } from '@/lib/ebios-data-i18n'
import type { Locale } from '@/lib/i18n'
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
  locale: Locale = 'fr',
): Record<string, unknown>[] {
  const a1 = t?.workshop?.a1
  const {
    VALEURS_METIER_EXEMPLES,
    BIENS_SUPPORTS_EXEMPLES,
    EVENEMENTS_REDOUTES_EXEMPLES,
    SOURCES_RISQUE_EXEMPLES,
    OBJECTIFS_VISES_EXEMPLES,
    SCENARIOS_STRATEGIQUES_EXEMPLES,
    PARTIES_PRENANTES_EXEMPLES,
    ACTIONS_ELEMENTAIRES_EXEMPLES,
    MESURES_ECOSYSTEME_EXEMPLES,
  } = getEbiosData(locale)
  switch (category) {
    case 'valeursMetier':
      return VALEURS_METIER_EXEMPLES.map((v, i) => ({
        nom: a1?.vmExamples?.[i]?.nom ?? v.nom,
        type: v.type,
        description: a1?.vmExamples?.[i]?.description ?? v.description,
        responsable: (v as { responsable?: string }).responsable ?? '',
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
    // Ateliers 2 à 5 — textes localisés via getEbiosData(locale) (repli FR) ;
    // un override organisation reste dans la langue saisie par l'admin.
    case 'sourcesRisque':
      return SOURCES_RISQUE_EXEMPLES.map((s) => ({
        nom: s.nom, categorie: s.categorie, description: s.description,
        motivation: s.motivation, ressources: s.ressources, pertinenceDefaut: s.pertinenceDefaut,
      }))
    case 'objectifsVises':
      return OBJECTIFS_VISES_EXEMPLES.map((o) => ({ nom: o.nom, description: o.description }))
    case 'scenariosStrategiques':
      return SCENARIOS_STRATEGIQUES_EXEMPLES.map((s) => ({
        critere: s.critere, nom: s.nom, description: s.description,
        vraisemblanceDefaut: s.vraisemblanceDefaut, graviteDefaut: s.graviteDefaut,
      }))
    case 'partiesPrenantes':
      return PARTIES_PRENANTES_EXEMPLES.map((p) => ({
        nom: p.nom, type: p.type,
        dependance: p.dependance, penetration: p.penetration,
        maturite: p.maturite, confiance: p.confiance,
      }))
    case 'actionsElementaires':
      return ACTIONS_ELEMENTAIRES_EXEMPLES.map((a) => ({ type: a.type, nom: a.nom, description: a.description }))
    case 'mesuresEcosysteme':
      return MESURES_ECOSYSTEME_EXEMPLES.map((m) => ({
        mesure: m.mesure, type: m.type, iso27005: m.iso27005, description: m.description,
      }))
    default:
      return []
  }
}
