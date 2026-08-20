// ─── Risk Appetite Statement (RAS) — assemblage de la donnée d'export ────────
// Le RAS est le document de GOUVERNANCE formalisant l'appétit au risque : seuil
// global + surcharges par catégorie, posture courante (conformité) et liste des
// dépassements (risques hors appétit). Réutilise le moteur `appetit.ts`. Logique
// PURE et testée ; l'API et le PDF ne font qu'appliquer cet assemblage.

import {
  type AppetitConfig, seuilApplicable, evaluerAppetit, synthetiserAppetit, type AppetitSynthese,
} from './appetit'

export interface RasRiskLite {
  intitule: string
  taxonomieCode: string | null
  niveauResiduel: number | null
}

export interface RasCategorieSeuil { code: string; label: string; seuil: number }
export interface RasDepassement {
  intitule: string
  categorieLabel: string
  niveauResiduel: number
  seuil: number
  ecart: number
}

export interface RasExportData {
  seuilGlobal: number | null
  categories: RasCategorieSeuil[]
  synthese: AppetitSynthese
  /** % de risques évaluables qui sont DANS l'appétit (100 si aucun évaluable). */
  tauxConformite: number
  depassements: RasDepassement[]
}

export function buildRasExport(
  risks: RasRiskLite[],
  cfg: AppetitConfig,
  labelOf: (code: string) => string,
): RasExportData {
  const categories: RasCategorieSeuil[] = Object.entries(cfg.parCategorie ?? {})
    .map(([code, seuil]) => ({ code, label: labelOf(code), seuil }))
    .sort((a, b) => a.code.localeCompare(b.code))

  const synthese = synthetiserAppetit(
    risks.map(r => ({ taxonomieCode: r.taxonomieCode, niveauResiduel: r.niveauResiduel })), cfg,
  )

  const depassements: RasDepassement[] = []
  for (const r of risks) {
    const seuil = seuilApplicable(cfg, r.taxonomieCode)
    if (evaluerAppetit(r.niveauResiduel, seuil) !== 'HORS') continue
    // HORS ⇒ seuil et niveauResiduel sont non nuls.
    const niveau = r.niveauResiduel as number
    const s = seuil as number
    depassements.push({
      intitule: r.intitule,
      categorieLabel: r.taxonomieCode ? labelOf(r.taxonomieCode) : '—',
      niveauResiduel: niveau, seuil: s, ecart: niveau - s,
    })
  }
  depassements.sort((a, b) => b.ecart - a.ecart || b.niveauResiduel - a.niveauResiduel)

  const tauxConformite = synthese.evalues ? Math.round((synthese.dansAppetit / synthese.evalues) * 100) : 100

  return { seuilGlobal: cfg.seuilGlobal ?? null, categories, synthese, tauxConformite, depassements }
}
