/**
 * sr-ov-radar.ts — Géométrie de la cartographie des couples SR/OV (Atelier 2).
 *
 * Exigence EXI_M2_09 du cahier des charges du label EBIOS Risk Manager (ANSSI v3.1) :
 * « L'application permet de représenter les couples source de risque/objectif visé
 * sur des cartographies visuelles de type radar. »
 *
 * Convention (alignée sur la cartographie de dangerosité de l'écosystème) :
 * le CENTRE correspond à la pertinence maximale (couples prioritaires), l'angle
 * répartit les couples autour du cercle. Géométrie pure → testée unitairement.
 */

export interface SrOvCouple {
  id: string
  sourceNom: string
  categorie: string
  ovNom: string
  pertinence: number // 1..4
  priorite: string   // 'P1' | 'P2'
}

interface SourceLike {
  nom?: string
  categorie?: string
  retenu?: boolean
  pertinence?: number
  objectifsVises?: Array<{ id?: string; nom?: string; priorite?: string; pertinenceOV?: number }>
}

/** Aplati les sources RETENUES en couples SR/OV (un point par objectif visé). */
export function srOvCouples(sources: SourceLike[] | null | undefined): SrOvCouple[] {
  if (!Array.isArray(sources)) return []
  const couples: SrOvCouple[] = []
  for (const s of sources) {
    if (!s?.retenu) continue
    for (const ov of s.objectifsVises ?? []) {
      couples.push({
        id: String(ov.id ?? `${s.nom}-${ov.nom}`),
        sourceNom: String(s.nom ?? ''),
        categorie: String(s.categorie ?? ''),
        ovNom: String(ov.nom ?? ''),
        // pertinence du couple si présente, sinon celle de la source.
        pertinence: clampPert(ov.pertinenceOV ?? s.pertinence ?? 2),
        priorite: ov.priorite === 'P1' ? 'P1' : 'P2',
      })
    }
  }
  return couples
}

function clampPert(p: number): number {
  const n = Math.round(Number(p))
  if (!Number.isFinite(n)) return 1
  return Math.min(4, Math.max(1, n))
}

/**
 * Rayon d'un couple selon sa pertinence : centre = pertinence maximale.
 * pertinence 4 → 0,25·rMax (central) ; pertinence 1 → rMax (périphérie).
 */
export function coupleRadiusFor(pertinence: number, rMax: number): number {
  return rMax * (5 - clampPert(pertinence)) / 4
}

/**
 * Position cartésienne d'un couple : angle réparti uniformément (depuis le haut,
 * sens horaire), rayon dérivé de la pertinence.
 */
export function couplePoint(
  index: number,
  total: number,
  pertinence: number,
  geom: { cx: number; cy: number; rMax: number },
): { x: number; y: number } {
  const n = Math.max(1, total)
  const theta = (index / n) * 2 * Math.PI // 0 = haut (12 h)
  const r = coupleRadiusFor(pertinence, geom.rMax)
  return {
    x: geom.cx + r * Math.sin(theta),
    y: geom.cy - r * Math.cos(theta),
  }
}

// ─── Cartographie améliorée : l'ANGLE encode la catégorie de source ──────────
// Chaque catégorie de source occupe un SECTEUR angulaire (une « part de camembert »),
// dans lequel ses couples sont répartis symétriquement. Le rayon reste la pertinence
// (centre = fort). Ainsi la position angulaire devient lisible : « ce secteur = tel
// type de source », et les couples d'une même source sont regroupés.

/** Catégories présentes, dans l'ordre stable d'apparition. */
export function categoriesInOrder(couples: SrOvCouple[]): string[] {
  const seen: string[] = []
  for (const c of couples) if (!seen.includes(c.categorie)) seen.push(c.categorie)
  return seen
}

/** Angle (radians, 0 = haut, horaire) du centre du secteur d'une catégorie. */
export function sectorCenterAngle(catIndex: number, nCats: number): number {
  const nc = Math.max(1, nCats)
  return ((catIndex + 0.5) / nc) * 2 * Math.PI
}

/**
 * Position d'un couple : angle = secteur de sa catégorie + répartition interne
 * (±40 % du secteur), rayon = pertinence. `localIndex`/`localCount` = rang du
 * couple parmi ceux de la même catégorie.
 */
export function couplePointSector(
  catIndex: number, nCats: number,
  localIndex: number, localCount: number,
  pertinence: number,
  geom: { cx: number; cy: number; rMax: number },
): { x: number; y: number } {
  const sector = (2 * Math.PI) / Math.max(1, nCats)
  const lc = Math.max(1, localCount)
  const offset = lc === 1 ? 0 : (localIndex / (lc - 1) - 0.5) * (sector * 0.8)
  const theta = sectorCenterAngle(catIndex, nCats) + offset
  const r = coupleRadiusFor(pertinence, geom.rMax)
  return { x: geom.cx + r * Math.sin(theta), y: geom.cy - r * Math.cos(theta) }
}

/** Point + ancrage texte pour le libellé d'une catégorie, à la périphérie du secteur. */
export function sectorLabelPoint(
  catIndex: number, nCats: number,
  geom: { cx: number; cy: number; rMax: number }, pad = 16,
): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const a = sectorCenterAngle(catIndex, nCats)
  const r = geom.rMax + pad
  const sinA = Math.sin(a)
  const anchor: 'start' | 'middle' | 'end' = Math.abs(sinA) < 0.3 ? 'middle' : (sinA > 0 ? 'start' : 'end')
  return { x: geom.cx + r * sinA, y: geom.cy - r * Math.cos(a), anchor }
}
