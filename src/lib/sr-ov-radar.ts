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
