/**
 * ecosystem-zoom.ts — Géométrie PURE du zoom/déplacement de la cartographie
 * écosystème (SVG à viewBox dynamique). Aucune dépendance DOM : le composant
 * lit ces fonctions pour recalculer le viewBox, zoomer au curseur et borner le
 * déplacement. Testé indépendamment du rendu.
 */

export interface Box { x: number; y: number; w: number; h: number }

export const ZOOM_MIN = 1
export const ZOOM_MAX = 6
/** Facteur d'un cran de zoom (molette / bouton). */
export const ZOOM_STEP = 1.25

export const clampZoom = (z: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))

/** viewBox effectif pour un niveau de zoom et un déplacement (unités viewBox). */
export function viewBox(base: Box, zoom: number, panX: number, panY: number): Box {
  const z = clampZoom(zoom)
  const w = base.w / z
  const h = base.h / z
  const cx = base.x + base.w / 2 + panX
  const cy = base.y + base.h / 2 + panY
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

/**
 * Borne le déplacement pour que le centre de la vue reste dans le cadre de base
 * (empêche de « perdre » la cartographie hors champ).
 */
export function clampPan(base: Box, panX: number, panY: number): { panX: number; panY: number } {
  const maxX = base.w / 2
  const maxY = base.h / 2
  return {
    panX: Math.max(-maxX, Math.min(maxX, panX)),
    panY: Math.max(-maxY, Math.min(maxY, panY)),
  }
}

/**
 * Zoom autour d'un curseur : `px`,`py` ∈ [0,1] = position relative du curseur
 * dans le cadre SVG. Renvoie le nouvel état {zoom,panX,panY} tel que le point
 * situé sous le curseur reste fixe à l'écran.
 */
export function zoomAtCursor(
  base: Box, zoom: number, panX: number, panY: number,
  nextZoomRaw: number, px: number, py: number,
): { zoom: number; panX: number; panY: number } {
  const z2 = clampZoom(nextZoomRaw)
  const vb = viewBox(base, zoom, panX, panY)
  const ux = vb.x + px * vb.w // point sous le curseur (coord. viewBox), invariant
  const uy = vb.y + py * vb.h
  const w2 = base.w / z2
  const h2 = base.h / z2
  const cx2 = ux - px * w2 + w2 / 2
  const cy2 = uy - py * h2 + h2 / 2
  const pan = clampPan(base, cx2 - (base.x + base.w / 2), cy2 - (base.y + base.h / 2))
  return { zoom: z2, panX: pan.panX, panY: pan.panY }
}

/**
 * Déplacement par glisser : convertit un delta pixels (dxPx,dyPx) en delta
 * viewBox selon la taille pixel du SVG (rectW,rectH). Un glisser vers la droite
 * fait suivre le contenu (le centre recule).
 */
export function panByPixels(
  base: Box, zoom: number, panX: number, panY: number,
  dxPx: number, dyPx: number, rectW: number, rectH: number,
): { panX: number; panY: number } {
  const vb = viewBox(base, zoom, panX, panY)
  const nx = panX - (dxPx / rectW) * vb.w
  const ny = panY - (dyPx / rectH) * vb.h
  return clampPan(base, nx, ny)
}
