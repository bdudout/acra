/**
 * ecosystem-radar.ts — Géométrie du radar de menace de l'écosystème (Atelier 3 EBIOS RM).
 *
 * Diagramme polaire de priorisation des parties prenantes (PP) : le rayon encode le
 * niveau de menace (centre = menace maximale), l'angle regroupe les PP par catégorie.
 *
 * MÉTHODE (fiche Club EBIOS « dangerosité des parties prenantes ») :
 *   exposition = dépendance × pénétration   (sous-critères 1..4 → 1..16)
 *   fiabilité  = maturité × confiance        (sous-critères 1..4 → 1..16)
 *   menace     = exposition / fiabilité       (ratio ≈ 0,06 .. 16)
 * Sous-critères en FLOTTANT (cotation fine possible) sur des échelles configurables.
 * 3 zones : danger / contrôle / veille (l'« hors-périmètre » du guide est l'espace
 * visuel au-delà de la veille, pas une zone). Bornes de menace dérivées des échelles.
 *
 * Module pur (sans React) → testé unitairement (cf. ecosystem-radar.test.ts).
 */

export type EcosystemZone = 'danger' | 'controle' | 'veille'

/** Bornes de la menace, dérivées des échelles configurées (cf. ecosystem-echelles.ts). */
export interface MenaceBounds {
  menaceMin: number
  menaceMax: number
}

export interface StakeholderInput {
  id?: string
  nom?: string
  /** Nom court affiché sur le radar (≤ 12 car.) ; sinon réf T1, T2… */
  nomCourt?: string
  type?: string
  exposition?: number // 1..N² (= dépendance × pénétration)
  fiabilite?: number  // 1..N² (= maturité × confiance)
  /** Tiers qualifié de critique (marquage manuel) — étoile + nom affichés sur le radar. */
  critique?: boolean
  // Sous-critères (1..N, flottants) — optionnels, propagés pour l'affichage au survol
  dependance?: number
  penetration?: number
  maturite?: number
  confiance?: number
}

export interface RadarGeometry {
  cx: number
  cy: number
  rMax: number
}

export interface RadarPoint {
  id: string
  /** Référence courte stable affichée sur le diagramme (T1, T2, …) pour croiser avec le tableau. */
  ref: string
  nom: string
  /** Nom court (≤ 12 car.) ; vide ⇒ le composant affiche la réf. */
  nomCourt: string
  type: string
  exposition: number   // 1..N²
  fiabilite: number    // 1..N²
  dependance: number   // 1..N
  penetration: number  // 1..N
  maturite: number     // 1..N
  confiance: number    // 1..N
  menace: number       // ratio exposition/fiabilité
  zone: EcosystemZone
  critique: boolean     // tiers qualifié de critique (marquage manuel)
  /** Afficher le nom à côté du point ? (critique OU zone danger/contrôle, cf. guide). */
  showLabel: boolean
  angleDeg: number      // depuis le haut, sens horaire
  x: number
  y: number
}

// Bornes PAR DÉFAUT de la menace (échelles 1..4 → exposition,fiabilité ∈ [1,16]).
// Les vues passent des bornes dérivées des échelles configurées (cf. bornesMenace).
export const MENACE_MIN = 1 / 16   // 0,0625
export const MENACE_MAX = 16

// Seuils de zones (fixes, sur l'échelle ratio) — stables et cohérents entre vues.
// 3 zones : « hors-périmètre » du guide n'est pas une zone mais l'espace visuel au-delà de la veille.
export const ZONE_DANGER_MIN = 3      // menace ≥ 3   → danger
export const ZONE_CONTROLE_MIN = 1.5  // menace ≥ 1,5 → contrôle ; sinon veille

// Ordre canonique des catégories (aligné sur l'enum Prisma TypePartiePrenante).
const TYPE_ORDER = [
  'FOURNISSEUR', 'CLIENT', 'PARTENAIRE', 'PRESTATAIRE',
  'ORGANISME_REGULATION', 'AUTRE',
]

/** Fraction du secteur sur laquelle les PP d'une même catégorie sont étalées. */
const SECTOR_SPREAD = 0.35

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Menace = exposition / fiabilité, entrées bornées à [1..N²] (N² par défaut = 16). */
export function menace(exposition: number, fiabilite: number, maxComposite = MENACE_MAX): number {
  const e = clamp(exposition || 1, 1, maxComposite)
  const f = clamp(fiabilite || 1, 1, maxComposite)
  return e / f
}

/** Menace à partir des 4 sous-critères (1..N chacun, flottants ; N=4 par défaut). */
export function menaceFromCriteria(dependance: number, penetration: number, maturite: number, confiance: number, maxN = 4): number {
  const exposition = clamp(dependance || 1, 1, maxN) * clamp(penetration || 1, 1, maxN)
  const fiabilite  = clamp(maturite || 1, 1, maxN)   * clamp(confiance || 1, 1, maxN)
  return exposition / fiabilite
}

/** Zone de menace (3 niveaux), seuils fixes sur l'échelle ratio. */
export function zoneOf(m: number): EcosystemZone {
  if (m >= ZONE_DANGER_MIN) return 'danger'
  if (m >= ZONE_CONTROLE_MIN) return 'controle'
  return 'veille'
}

/**
 * Rayon d'un point : menace minimale au bord (rMax), maximale au centre (0).
 *
 * Découpage en 3 zones d'ÉGALE largeur radiale (1/3 du rayon chacune) : danger
 * occupe le disque central [0, rMax/3], contrôle l'anneau [rMax/3, 2·rMax/3] et
 * veille l'anneau extérieur [2·rMax/3, rMax]. Au sein de chaque bande, la position
 * est interpolée en log selon la menace (les seuils délimitent les bandes, les
 * bornes d'échelle bornent les bandes extrêmes).
 */
export function radiusFor(m: number, rMax: number, menaceMin = MENACE_MIN, menaceMax = MENACE_MAX): number {
  const third = rMax / 3
  const c = clamp(m, Math.min(menaceMin, ZONE_CONTROLE_MIN), Math.max(menaceMax, ZONE_DANGER_MIN))
  // Fraction log de v dans [lo, hi] (0 au bas, 1 au haut) ; 0 si bande dégénérée.
  const frac = (v: number, lo: number, hi: number) => {
    const d = Math.log(hi) - Math.log(lo)
    return d <= 0 ? 0 : clamp((Math.log(v) - Math.log(lo)) / d, 0, 1)
  }
  if (c >= ZONE_DANGER_MIN) {
    // danger : menace [ZONE_DANGER_MIN .. menaceMax] → rayon [third .. 0]
    const t = frac(c, ZONE_DANGER_MIN, Math.max(menaceMax, ZONE_DANGER_MIN))
    return third * (1 - t)
  }
  if (c >= ZONE_CONTROLE_MIN) {
    // contrôle : menace [ZONE_CONTROLE_MIN .. ZONE_DANGER_MIN] → rayon [2·third .. third]
    const t = frac(c, ZONE_CONTROLE_MIN, ZONE_DANGER_MIN)
    return third * (2 - t)
  }
  // veille : menace [menaceMin .. ZONE_CONTROLE_MIN] → rayon [rMax .. 2·third]
  const t = frac(c, Math.min(menaceMin, ZONE_CONTROLE_MIN), ZONE_CONTROLE_MIN)
  return third * (3 - t)
}

/** Rayons des anneaux de zone : 3 zones égales (chacune 1/3 du rayon). */
export function zoneRadii(rMax: number, _menaceMin = MENACE_MIN, _menaceMax = MENACE_MAX): { danger: number; controle: number; rim: number } {
  const third = rMax / 3
  return {
    danger: third,        // disque danger : r < rMax/3
    controle: 2 * third,  // anneau contrôle : rMax/3 .. 2·rMax/3
    rim: rMax,            // anneau veille : 2·rMax/3 .. rMax
  }
}

/** Niveau 0..3 par quartile de la plage [1, max] (échelle adaptable). */
function quartileLevel(value: number, max: number): 0 | 1 | 2 | 3 {
  if (max <= 1) return 0
  const frac = (clamp(value, 1, max) - 1) / (max - 1)
  return clamp(Math.floor(frac * 4), 0, 3) as 0 | 1 | 2 | 3
}

/**
 * Niveau de COULEUR d'un point selon la FIABILITÉ : 0 = rouge (faible fiabilité,
 * risqué) → 3 = vert (forte fiabilité). Par quartiles de [1, maxFiab].
 */
export function fiabiliteLevel(fiabilite: number, maxFiab = MENACE_MAX): 0 | 1 | 2 | 3 {
  return quartileLevel(fiabilite, maxFiab)
}

/**
 * Niveau de TAILLE d'un point selon l'EXPOSITION : 0 = plus petit → 3 = plus gros.
 * Par quartiles de [1, maxExpo].
 */
export function expositionLevel(exposition: number, maxExpo = MENACE_MAX): 0 | 1 | 2 | 3 {
  return quartileLevel(exposition, maxExpo)
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
/** Référence courte stable d'une partie prenante par son rang : T1, T2, … */
export function stakeholderRef(index: number): string {
  return `T${index + 1}`
}

export function layoutStakeholders(
  parties: StakeholderInput[],
  geom: RadarGeometry,
  bounds?: MenaceBounds,
): RadarPoint[] {
  if (!parties.length) return []

  const menaceMin = bounds?.menaceMin ?? MENACE_MIN
  const menaceMax = bounds?.menaceMax ?? MENACE_MAX
  // Borne de clamp des composites = menace max (= exposition max d'une fiabilité de 1).
  const maxComposite = menaceMax

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
  parties.forEach((p, originalIdx) => {
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

    const m = menace(p.exposition ?? 1, p.fiabilite ?? 1, maxComposite)
    const r = radiusFor(m, geom.rMax, menaceMin, menaceMax)
    const [x, y] = polarToXY(r, angleDeg, geom.cx, geom.cy)
    const zone = zoneOf(m)
    const critique = !!p.critique

    points.push({
      id: String(p.id ?? ''),
      ref: stakeholderRef(originalIdx),
      nom: String(p.nom ?? ''),
      nomCourt: String(p.nomCourt ?? '').slice(0, 12),
      type: ty,
      exposition: clamp(p.exposition ?? 1, 1, maxComposite),
      fiabilite: clamp(p.fiabilite ?? 1, 1, maxComposite),
      // Sous-critères : bornés à √(maxComposite) (échelle d'un critère), min 1.
      dependance: clamp(p.dependance ?? 1, 1, Math.sqrt(maxComposite)),
      penetration: clamp(p.penetration ?? 1, 1, Math.sqrt(maxComposite)),
      maturite: clamp(p.maturite ?? 1, 1, Math.sqrt(maxComposite)),
      confiance: clamp(p.confiance ?? 1, 1, Math.sqrt(maxComposite)),
      menace: m,
      zone,
      critique,
      showLabel: critique || zone === 'danger' || zone === 'controle',
      angleDeg,
      x,
      y,
    })
  })
  return points
}
