/**
 * ecosystem-radar.ts — Géométrie du radar de menace de l'écosystème (Atelier 3 EBIOS RM).
 *
 * Diagramme polaire de priorisation des parties prenantes (PP) : le rayon encode le
 * niveau de menace (centre = menace maximale), l'angle regroupe les PP par catégorie.
 *
 * IMPORTANT — cohérence avec le reste de l'application :
 * la menace et les zones reprennent EXACTEMENT le calcul déjà utilisé dans Atelier3
 * (vulnerabilite = ⌈ exposition × (5 − fiabilité) / 4 ⌉, danger ≥4 · contrôle =3 · veille ≤2),
 * afin que le radar et les listes de zones affichées restent toujours synchronisés.
 *
 * Module pur (sans React) → testé unitairement (cf. ecosystem-radar.test.ts).
 */

export type EcosystemZone = 'danger' | 'controle' | 'veille'

export interface StakeholderInput {
  id?: string
  nom?: string
  type?: string
  exposition?: number // 1..4
  fiabilite?: number  // 1..4
}

export interface RadarGeometry {
  cx: number
  cy: number
  rMax: number
}

export interface RadarPoint {
  id: string
  nom: string
  type: string
  exposition: number
  fiabilite: number
  menace: number       // 1..16 (continu)
  zone: EcosystemZone
  angleDeg: number      // depuis le haut, sens horaire
  x: number
  y: number
}

export const MENACE_MIN = 1
export const MENACE_MAX = 16

// Frontières de zones, alignées sur les paliers vulnerabilite = ⌈menace/4⌉ :
//   menace > 12  → vuln 4 → danger
//   8 < menace ≤ 12 → vuln 3 → contrôle
//   menace ≤ 8   → vuln ≤2 → veille
export const ZONE_DANGER_MIN = 12
export const ZONE_CONTROLE_MIN = 8

// Ordre canonique des catégories (aligné sur l'enum Prisma TypePartiePrenante).
const TYPE_ORDER = [
  'FOURNISSEUR', 'CLIENT', 'PARTENAIRE', 'PRESTATAIRE',
  'SOUS_TRAITANT', 'ORGANISME_REGULATION', 'AUTRE',
]

/** Fraction du secteur sur laquelle les PP d'une même catégorie sont étalées. */
const SECTOR_SPREAD = 0.35

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Menace = exposition × (5 − fiabilité), entrées bornées à [1..4]. Résultat ∈ [1..16]. */
export function menace(exposition: number, fiabilite: number): number {
  const e = clamp(Math.round(exposition) || 1, 1, 4)
  const f = clamp(Math.round(fiabilite) || 1, 1, 4)
  return e * (5 - f)
}

/** Zone de menace, cohérente avec le bucket ⌈menace/4⌉. */
export function zoneOf(m: number): EcosystemZone {
  if (m > ZONE_DANGER_MIN) return 'danger'
  if (m > ZONE_CONTROLE_MIN) return 'controle'
  return 'veille'
}

/** Rayon inversé : menace minimale au bord (rMax), maximale au centre (0). */
export function radiusFor(m: number, rMax: number): number {
  const n = (clamp(m, MENACE_MIN, MENACE_MAX) - MENACE_MIN) / (MENACE_MAX - MENACE_MIN)
  return rMax * (1 - n)
}

/** Rayons des anneaux de zone (frontières danger/contrôle et contrôle/veille, + bord). */
export function zoneRadii(rMax: number): { danger: number; controle: number; rim: number } {
  return {
    danger: radiusFor(ZONE_DANGER_MIN, rMax),   // disque danger : r < ce rayon
    controle: radiusFor(ZONE_CONTROLE_MIN, rMax),
    rim: rMax,
  }
}

/** Conversion polaire → cartésien. angleDeg mesuré depuis le haut (12 h), sens horaire. */
export function polarToXY(r: number, angleDeg: number, cx: number, cy: number): [number, number] {
  const a = (angleDeg - 90) * Math.PI / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

/** Types distincts présents, triés selon l'ordre canonique (types inconnus en fin). */
export function presentTypes(parties: Array<{ type?: string }>): string[] {
  const seen = new Set<string>()
  for (const p of parties) seen.add(p.type || 'AUTRE')
  return [...seen].sort((a, b) => {
    const ia = TYPE_ORDER.indexOf(a), ib = TYPE_ORDER.indexOf(b)
    return (ia === -1 ? TYPE_ORDER.length : ia) - (ib === -1 ? TYPE_ORDER.length : ib)
  })
}

/**
 * Calcule la position de chaque PP sur le radar.
 *  - rayon ← menace (centre = max)
 *  - angle ← secteur de la catégorie ; les PP d'une même catégorie sont étalées
 *    angulairement (jitter déterministe) pour éviter le chevauchement.
 */
export function layoutStakeholders(
  parties: StakeholderInput[],
  geom: RadarGeometry,
): RadarPoint[] {
  if (!parties.length) return []

  const types = presentTypes(parties)
  const n = types.length
  const sectorWidth = 360 / n

  // Index des PP au sein de leur secteur (pour le jitter).
  const perType = new Map<string, StakeholderInput[]>()
  for (const p of parties) {
    const ty = p.type || 'AUTRE'
    if (!perType.has(ty)) perType.set(ty, [])
    perType.get(ty)!.push(p)
  }

  const points: RadarPoint[] = []
  for (const p of parties) {
    const ty = p.type || 'AUTRE'
    const sectorIndex = types.indexOf(ty)
    const sectorCenter = sectorIndex * sectorWidth

    const group = perType.get(ty)!
    const k = group.length
    const posInGroup = group.indexOf(p)

    // Étalement symétrique autour du centre du secteur : une seule PP → centre exact.
    let angleDeg = sectorCenter
    if (k > 1) {
      const halfSpread = sectorWidth * SECTOR_SPREAD
      const ratio = posInGroup / (k - 1) // 0..1
      angleDeg = sectorCenter - halfSpread + ratio * (2 * halfSpread)
    }

    const m = menace(p.exposition ?? 1, p.fiabilite ?? 1)
    const r = radiusFor(m, geom.rMax)
    const [x, y] = polarToXY(r, angleDeg, geom.cx, geom.cy)

    points.push({
      id: String(p.id ?? ''),
      nom: String(p.nom ?? ''),
      type: ty,
      exposition: clamp(Math.round(p.exposition ?? 1) || 1, 1, 4),
      fiabilite: clamp(Math.round(p.fiabilite ?? 1) || 1, 1, 4),
      menace: m,
      zone: zoneOf(m),
      angleDeg,
      x,
      y,
    })
  }
  return points
}
