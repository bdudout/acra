// ─── Import : niveau de risque du fichier vs calcul ACRA (B-IMP-09) — PUR ─────
// ACRA recalcule le niveau (gravité × vraisemblance, paliers ou matrice qualitative de l'organisation) : la valeur du
// fichier est ignorée. Si elle diverge, un avertissement `risk_level_differs:<risque>:<fichier>:<ACRA>` rejoint le bilan
// — jamais de correction silencieuse. Un niveau chiffré se compare au score ; un libellé, au palier de la matrice (un
// libellé absent de la matrice, autre vocabulaire, n'est pas comparable : pas de faux avertissement).
// Testé : import-niveau-risque.test.ts.
import { computeRiskScore, getRiskLevel, resolveScaleConfig, type ScaleConfig } from '@/lib/risk-scale'

export interface RisqueNiveauImporte { externalId?: string; title: string; gravity?: number; likelihood?: number; riskLevel?: string }

const normaliser = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
/** Les « : » séparent les arguments du code d'avertissement. */
const neutraliser = (s: string) => s.replace(/\s*:\s*/g, ' – ').trim()

export function divergencesNiveauRisque(risques: RisqueNiveauImporte[], echelles?: Partial<ScaleConfig> | null): string[] {
  const cfg = resolveScaleConfig(echelles)
  const libelles = new Set(cfg.seuilsMatrice.map(s => normaliser(s.label)))
  const out: string[] = []
  for (const r of risques) {
    const fichier = r.riskLevel?.trim()
    if (!fichier || !r.gravity || !r.likelihood) continue
    const nombre = Number(fichier.replace(',', '.'))
    let calcule: string | null = null
    if (Number.isFinite(nombre)) {
      const score = computeRiskScore(r.gravity, r.likelihood)
      if (nombre !== score) calcule = String(score)
    } else if (libelles.has(normaliser(fichier))) {
      const palier = getRiskLevel(r.gravity, r.likelihood, cfg).label
      if (normaliser(palier) !== normaliser(fichier)) calcule = palier
    }
    if (calcule !== null) out.push(`risk_level_differs:${neutraliser(r.externalId || r.title)}:${neutraliser(fichier)}:${calcule}`)
  }
  return out
}
