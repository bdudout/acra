// ─── Suggestions de risques sectoriels (saisie directe) ──────────────────────
// R3 du chantier multi-méthode : propose des risques « prêts à cliquer » pour les
// parcours à saisie directe (ISO 31000 / ISO 27005 / NIST 800-30), dérivés des
// packs sectoriels existants (`exemples-sectoriels.ts`). Deux sources :
//   - scénarios stratégiques  → intitulé = nom ; G/V = valeurs d'origine ;
//   - événements redoutés      → intitulé = description ; G d'origine, V par défaut.
// Classement par pertinence (secteur / sous-secteur) via `rankExemples`. Les
// valeurs G/V restent des SUGGESTIONS clairement modifiables (l'UI pré-remplit un
// formulaire, elle ne crée rien sans confirmation). Module PUR → testé.

import type { Locale } from '@/lib/i18n'
import { sectorExemplesFor } from '@/lib/exemples-sectoriels'
import { rankExemples } from '@/lib/exemples-context'

/** Suggestion de risque à saisie directe (intitulé + gravité/vraisemblance suggérées). */
export interface RisqueExemple {
  intitule: string
  gravite: number
  vraisemblance: number
  /** Vrai si l'exemple est jugé pertinent pour le contexte (badge UI). */
  pertinent: boolean
}

/** Valeur par défaut d'une vraisemblance absente (événements redoutés). */
const V_DEFAULT = 2

/** Ramène une note dans l'échelle 1..4 (repli sur `def`). */
function clamp1to4(v: unknown, def: number): number {
  const n = typeof v === 'number' ? Math.round(v) : NaN
  return Number.isFinite(n) ? Math.min(4, Math.max(1, n)) : def
}

/**
 * Retire le suffixe de critère EBIOS « (C) / (I) / (D) / (T) » d'un intitulé
 * (Confidentialité/Intégrité/Disponibilité/Traçabilité). Ces suffixes viennent des
 * scénarios stratégiques EBIOS et n'ont pas de sens pour les méthodes à saisie
 * directe (ISO 31000 / ISO 27005 / NIST), où ces suggestions sont proposées.
 */
export function stripEbiosCritere(intitule: string): string {
  return intitule.replace(/\s*\([CIDT]\)\s*$/, '').trim()
}

/**
 * Suggestions de risques pour le secteur/sous-secteur de l'analyse. `[]` si le
 * secteur n'appartient à aucune famille connue. Déduplique par intitulé (insensible
 * à la casse), classe les plus pertinents en tête, borne la liste à `limit`.
 */
export function suggestRisqueExemples(opts: {
  secteur?: string | null
  sousSecteur?: string | null
  locale?: Locale
  limit?: number
  /** Socle de risques TRANSVERSES (tous secteurs), résolu i18n par la page.
   *  Toujours proposé — même sans secteur — pour ne jamais laisser l'écran vide. */
  base?: readonly { intitule: string; gravite: number; vraisemblance: number }[]
}): RisqueExemple[] {
  const { secteur, sousSecteur, locale = 'fr', limit = 12, base = [] } = opts

  const scen = secteur ? sectorExemplesFor(secteur, 'scenariosStrategiques', locale, sousSecteur) : []
  const evt = secteur ? sectorExemplesFor(secteur, 'evenementsRedoutes', locale, sousSecteur) : []

  // Objets « rankables » (conservent nom/description/impacts pour le scoring) +
  // champs privés portant l'intitulé et les notes suggérées.
  const raw = [
    ...scen.map(x => ({
      ...x,
      _intitule: stripEbiosCritere(String(x.nom ?? x.description ?? '').trim()),
      _g: clamp1to4(x.graviteDefaut, V_DEFAULT),
      _v: clamp1to4(x.vraisemblanceDefaut, V_DEFAULT),
    })),
    ...evt.map(x => ({
      ...x,
      _intitule: stripEbiosCritere(String(x.description ?? '').trim()),
      _g: clamp1to4(x.graviteDefaut, V_DEFAULT),
      _v: V_DEFAULT,
    })),
  ].filter(x => x._intitule.length > 0)

  const ranked = rankExemples(raw, { secteur, sousSecteur })

  // Candidats : sectoriels (les plus pertinents en tête) PUIS socle transverse.
  // Le socle transverse est toujours proposé (pertinent=false) — jamais d'écran vide.
  const candidates: RisqueExemple[] = [
    ...ranked.map(r => ({ intitule: r._intitule, gravite: r._g, vraisemblance: r._v, pertinent: r.pertinent })),
    ...base.map(b => ({
      intitule: stripEbiosCritere(String(b.intitule ?? '').trim()),
      gravite: clamp1to4(b.gravite, V_DEFAULT),
      vraisemblance: clamp1to4(b.vraisemblance, V_DEFAULT),
      pertinent: false,
    })),
  ].filter(c => c.intitule.length > 0)

  const seen = new Set<string>()
  const out: RisqueExemple[] = []
  for (const c of candidates) {
    const key = c.intitule.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
    if (out.length >= limit) break
  }
  return out
}
