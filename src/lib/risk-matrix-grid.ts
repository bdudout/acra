// ─── Matrice des risques : modèle depuis la configuration + grille prête à imprimer (PUR) ─────────────────────────────────
// Partagé par les exports (Word, PowerPoint) : mêmes échelles, mêmes paliers et mêmes couleurs que l'application — jamais un
// barème codé en dur. Aucune dépendance à docx / pptxgenjs.

import { buildRiskMatrixModel, type EchelleNiveau, type MatrixModel, type ScaleConfig, type Seuil } from './risk-scale'

type Any = Record<string, unknown> // eslint-disable-line @typescript-eslint/no-explicit-any
const asArr = (v: unknown): Any[] => (Array.isArray(v) ? (v as Any[]) : [])

/** Ne conserve que des entrées d'échelle valides (repli sur les défauts sinon). */
export function cleanEchelle(v: unknown): EchelleNiveau[] | undefined {
  const arr = asArr(v).filter(e => e && typeof e === 'object' && typeof e.niveau === 'number')
  return arr.length ? (arr as unknown as EchelleNiveau[]) : undefined
}
export function cleanSeuils(v: unknown): Seuil[] | undefined {
  const arr = asArr(v).filter(e => e && typeof e === 'object' && typeof e.scoreMin === 'number')
  return arr.length ? (arr as unknown as Seuil[]) : undefined
}

/** Modèle de matrice d'après la configuration globale (échelles, seuils, mode qualitatif) ; défauts si absente ou invalide. */
export function matrixModelFromConfig(config: Any | null | undefined): MatrixModel {
  const c = (config ?? {}) as Any
  const scaleInput: Partial<ScaleConfig> = {
    nbNiveaux: c.nbNiveaux === 5 ? 5 : undefined,
    echelleGravite: cleanEchelle(c.echelleGravite),
    echelleVraisemblance: cleanEchelle(c.echelleVraisemblance),
    seuilsMatrice: cleanSeuils(c.seuilsMatrice),
    matriceMode: c.matriceMode === 'QUALITATIVE' ? 'QUALITATIVE' : undefined,
    matriceQualitative: asArr(c.matriceQualitative).length ? (c.matriceQualitative as ScaleConfig['matriceQualitative']) : undefined,
  }
  return buildRiskMatrixModel(scaleInput)
}

const hex6 = (c: unknown, fallback = '9CA3AF'): string => {
  const v = String(c ?? '').replace('#', '').trim()
  return /^[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : fallback
}
/** Mélange avec du blanc (22 % de transparence, comme la carto PowerPoint) : le texte noir reste lisible. */
function lighten(color: string, ratio = 0.22): string {
  const n = parseInt(color, 16)
  const mix = (channel: number) => Math.round(channel + (255 - channel) * ratio).toString(16).padStart(2, '0')
  return `${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`.toUpperCase()
}

export interface MatrixGrid {
  /** En-têtes de colonnes : gravité croissante (« 4 · Critique »). */
  header: { text: string }[]
  /** Lignes : vraisemblance décroissante (plus probable en haut). */
  rows: { label: string; cells: { text: string; fill: string }[] }[]
  /** Paliers de niveau (du plus faible au plus fort), pour la légende. */
  legend: { label: string; fill: string }[]
}

/** Grille de la matrice : chaque case liste les risques `Rn` placés par `place` (couple gravité × vraisemblance). */
export function buildMatrixGrid(model: MatrixModel, risques: Any[], place: (r: Any) => { g: number; v: number }): MatrixGrid {
  const header = model.graviteLevels.map(l => ({ text: `${l.niveau} · ${l.label}` }))
  const vDesc = [...model.vraisemblanceLevels].sort((a, b) => b.niveau - a.niveau)
  const rows = model.cells.map((row, ri) => ({
    label: `${vDesc[ri].niveau} · ${vDesc[ri].label}`,
    cells: row.map(cell => ({
      text: risques.flatMap((r, idx) => { const p = place(r); return p.g === cell.gravite && p.v === cell.vraisemblance ? [`R${idx + 1}`] : [] }).join(' '),
      fill: lighten(hex6(cell.couleur)),
    })),
  }))
  const palier = new Map<string, { fill: string; min: number }>()
  model.cells.flat().forEach(c => { const cur = palier.get(c.label); if (!cur || c.score < cur.min) palier.set(c.label, { fill: lighten(hex6(c.couleur)), min: c.score }) })
  const legend = [...palier.entries()].sort((a, b) => a[1].min - b[1].min).map(([label, { fill }]) => ({ label, fill }))
  return { header, rows, legend }
}
