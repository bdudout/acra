// ─── Historique d'appétence (RAS / RAD) : instantanés mensuels et tendances (PUR) ────────────────────────────────────
// Un instantané est un RÉSUMÉ d'agrégats (aucun intitulé de risque ni de KRI) figé pour un mois ; l'historique ne se
// reconstitue pas rétroactivement : il commence au premier instantané capturé.
import type { Voyant } from './ras-rad'

export interface ResumeAppetence {
  global: Voyant
  appetit?: { evalues: number; horsAppetit: number; seuilGlobal: number | null; voyant: Voyant }
  maturite: { code: string; belowTarget: number; assessed: number; averageCurrent: number | null; averageTarget: number | null; voyant: Voyant }[]
  kri?: { total: number; alerte: number; critique: number; voyant: Voyant }
}

/** Mois UTC (AAAA-MM) : clé d'unicité d'un instantané par organisation. */
export const periodeCourante = (now: Date): string => now.toISOString().slice(0, 7)

interface RasRadLike {
  global: Voyant
  modules: { registre: boolean; maturite: boolean; kri: boolean }
  appetit: { synthese: { evalues: number; horsAppetit: number }; seuilGlobal: number | null; voyant: Voyant } | null
  maturite: { code: string; belowTarget: number; assessed: number; averageCurrent: number | null; averageTarget: number | null; voyant: Voyant }[]
  kri: { total: number; alerte: number; critique: number; voyant: Voyant } | null
}

/** Résumé figé : agrégats seulement (les sections des modules inactifs sont omises). */
export function resumeDepuisRasRad(d: RasRadLike): ResumeAppetence {
  return {
    global: d.global,
    ...(d.modules.registre && d.appetit ? { appetit: { evalues: d.appetit.synthese.evalues, horsAppetit: d.appetit.synthese.horsAppetit, seuilGlobal: d.appetit.seuilGlobal, voyant: d.appetit.voyant } } : {}),
    maturite: d.modules.maturite ? d.maturite.map(m => ({ code: m.code, belowTarget: m.belowTarget, assessed: m.assessed, averageCurrent: m.averageCurrent, averageTarget: m.averageTarget, voyant: m.voyant })) : [],
    ...(d.modules.kri && d.kri ? { kri: { total: d.kri.total, alerte: d.kri.alerte, critique: d.kri.critique, voyant: d.kri.voyant } } : {}),
  }
}

export interface Tendance {
  periode: string
  resume: ResumeAppetence
  /** Écarts avec la période précédente (positif = davantage de risques / d'alertes) ; null pour la première. */
  delta: { horsAppetit: number; kriAlerte: number; kriCritique: number; maturiteSousCible: number } | null
  sens: 'AMELIORATION' | 'DEGRADATION' | 'STABLE' | null
}

/** Trie du plus ancien au plus récent et calcule, pour chaque période, l'écart avec la précédente. */
export function tendances(snaps: { periode: string; resume: ResumeAppetence }[]): Tendance[] {
  const ordered = [...snaps].sort((a, b) => a.periode.localeCompare(b.periode))
  const sousCible = (r: ResumeAppetence) => r.maturite.reduce((n, m) => n + m.belowTarget, 0)
  return ordered.map((s, i) => {
    if (i === 0) return { ...s, delta: null, sens: null }
    const p = ordered[i - 1].resume
    const delta = {
      horsAppetit: (s.resume.appetit?.horsAppetit ?? 0) - (p.appetit?.horsAppetit ?? 0),
      kriAlerte: (s.resume.kri?.alerte ?? 0) - (p.kri?.alerte ?? 0),
      kriCritique: (s.resume.kri?.critique ?? 0) - (p.kri?.critique ?? 0),
      maturiteSousCible: sousCible(s.resume) - sousCible(p),
    }
    const solde = delta.horsAppetit + delta.kriAlerte + delta.kriCritique + delta.maturiteSousCible
    return { ...s, delta, sens: solde < 0 ? 'AMELIORATION' : solde > 0 ? 'DEGRADATION' : 'STABLE' }
  })
}
