// ─── Risques sectoriels proposés à la création (pack postal, lot L4.1) — PUR ──
// Après les risques issus de la qualification, la fenêtre « Risques proposés » des méthodes à saisie directe ajoute
// jusqu'à 5 suggestions sectorielles : mêmes contenus et même classement que les suggestions de la phase 2
// (lib/risque-exemples), seulement celles jugées pertinentes, DÉCOCHÉES par défaut, sans doublon d'intitulé avec les
// risques de qualification ou déjà présents. Identifiant stable (`secteur:` + intitulé normalisé) : la création est
// idempotente par la contrainte analyse × règle. Testé : risques-sectoriels-proposes.test.ts.
import type { Locale } from '@/lib/i18n'
import { suggestRisqueExemples } from '@/lib/risque-exemples'

export const PREFIXE_RISQUE_SECTORIEL = 'secteur:'
export const MAX_RISQUES_SECTORIELS = 5

export interface RisqueSectorielPropose {
  id: string; title: string; description?: string; mandatory: false; preselected: false
  category: 'CYBER'; gravity: number; likelihood: number; strategy: 'REDUIRE'
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)

export function risquesSectorielsProposes(opts: {
  secteur?: string | null; sousSecteurs?: readonly string[] | null; patterns?: readonly string[] | null
  locale: Locale; exclus: readonly string[]; max?: number
}): RisqueSectorielPropose[] {
  const { secteur, sousSecteurs, patterns, locale, exclus, max = MAX_RISQUES_SECTORIELS } = opts
  if (!secteur && !patterns?.length) return []
  const vus = new Set(exclus.map(norm))
  const out: RisqueSectorielPropose[] = []
  for (const r of suggestRisqueExemples({ secteur, sousSecteur: sousSecteurs ?? null, patterns, locale, limit: 50 })) {
    if (!r.pertinent || out.length >= max) continue
    const k = norm(r.intitule)
    if (!k || vus.has(k)) continue
    vus.add(k)
    out.push({ id: `${PREFIXE_RISQUE_SECTORIEL}${slug(r.intitule)}`, title: r.intitule, mandatory: false, preselected: false, category: 'CYBER', gravity: r.gravite, likelihood: r.vraisemblance, strategy: 'REDUIRE' })
  }
  return out
}
