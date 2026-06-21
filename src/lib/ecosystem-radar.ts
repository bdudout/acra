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
  /** Profondeur d'écosystème : rang 1 (direct), 2 ou 3 (PP connexe d'un tiers critique). */
  rang?: number
  /** Clé stable de la PP et de sa parente (pour relier les rangs 2/3 sur le radar). */
  cle?: string
  parentCle?: string
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
  rang: number          // 1 (direct) · 2 · 3 (PP connexe)
  cle: string           // clé stable
  parentCle: string     // clé stable de la PP parente (vide si rang 1)
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

/**
 * Fraction du DEMI-secteur réellement utilisée pour étaler les PP (le reste = marge
 * vers les bords). < 1 garantit que les points restent visiblement au cœur de leur
 * catégorie et ne jouxtent pas le secteur voisin, même dans un secteur étroit.
 */
const SECTOR_FILL = 0.66

// Empreinte approximative d'un point pour l'anti-chevauchement des PP connexes :
// cercle (rayon max) + libellé texte à droite. Aligné sur EXPO_RADIUS du composant.
const POINT_R = 14      // rayon max d'un point
const CHAR_W = 5.6      // largeur moyenne d'un caractère de libellé (fontSize ~9.5)
const LABEL_PAD = 6     // marge autour du libellé
const BOUNDARY_GAP = 2  // marge supplémentaire entre le cercle et le bord du secteur

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Demi-angle (deg) qu'occupe un cercle de rayon pr à la distance radiale r du centre. */
function angularRadiusDeg(r: number, pr: number): number {
  if (r <= pr) return 90
  return (Math.asin(Math.min(1, pr / r)) * 180) / Math.PI
}

/**
 * Demi-ouverture angulaire utilisable au sein d'un secteur pour qu'un point situé
 * à la distance radiale r (et de rayon ~POINT_R) ne déborde PAS sur les traits de
 * séparation des catégories. Un point proche du centre occupe un angle plus large,
 * il est donc davantage contraint vers le centre du secteur.
 */
function safeHalfAngle(r: number, widthDeg: number): number {
  return Math.max(0, widthDeg / 2 - angularRadiusDeg(r, POINT_R + BOUNDARY_GAP))
}

/**
 * Demi-ouverture angulaire réellement utilisée : le minimum entre la marge sûre
 * (diamètre du point) et la fraction du demi-secteur (marge vers les bords). Garantit
 * que les points restent au cœur de leur catégorie, dans un secteur large comme étroit.
 */
function usableHalfAngle(r: number, widthDeg: number): number {
  return Math.min(safeHalfAngle(r, widthDeg), (widthDeg / 2) * SECTOR_FILL)
}

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

/** Secteur angulaire d'une catégorie sur le radar. */
export interface SectorSpan {
  type: string
  /** Angle du bord initial (sens horaire, depuis le haut) — pour les séparateurs. */
  startDeg: number
  /** Largeur angulaire (proportionnelle au nombre de PP de la catégorie). */
  widthDeg: number
  /** Angle central — pour positionner le libellé de catégorie. */
  centerDeg: number
}

// Largeur angulaire minimale d'un secteur (assez pour son libellé), bornée à 360/n.
// Volontairement basse : une catégorie à 1–2 PP n'a pas besoin de beaucoup d'angle,
// ce qui laisse davantage de place aux catégories denses (ex. prestataires).
const SECTOR_MIN_DEG = 22

/**
 * Découpe le cercle en secteurs dont la largeur est PROPORTIONNELLE au nombre de
 * parties prenantes de chaque catégorie (avec un minimum pour rester lisible),
 * le premier secteur étant centré en haut (12 h). Évite l'entassement des
 * catégories denses (ex. beaucoup de prestataires).
 */
export function sectorSpans(parties: Array<{ type?: string }>): SectorSpan[] {
  const types = presentTypes(parties)
  const n = types.length
  if (n === 0) return []
  const counts = types.map(ty => parties.filter(p => (p.type || 'AUTRE') === ty).length || 1)
  const total = counts.reduce((a, b) => a + b, 0)
  const minDeg = Math.min(SECTOR_MIN_DEG, 360 / n)
  const remaining = 360 - minDeg * n
  const widths = counts.map(c => minDeg + remaining * (c / total))
  // Décalage global : centrer le 1er secteur en haut (0°).
  const offset = -widths[0] / 2
  const spans: SectorSpan[] = []
  let cum = 0
  for (let i = 0; i < n; i++) {
    const startDeg = offset + cum
    spans.push({ type: types[i], startDeg, widthDeg: widths[i], centerDeg: startDeg + widths[i] / 2 })
    cum += widths[i]
  }
  return spans
}

/**
 * Calcule la position de chaque PP sur le radar.
 *  - rayon ← menace (centre = max)
 *  - angle ← secteur (proportionnel) de la catégorie ; les PP d'une même catégorie
 *    sont étalées angulairement (jitter déterministe) pour éviter le chevauchement.
 */
/** Référence courte stable d'une partie prenante par son rang : T1, T2, … */
export function stakeholderRef(index: number): string {
  return `T${index + 1}`
}

/**
 * Boîte englobante d'un point (cercle + libellé) à une position donnée. Le libellé est
 * placé du côté EXTÉRIEUR (vers la gauche si le point est à gauche du centre, sinon à
 * droite) — cohérent avec le rendu — pour éviter qu'il s'étende vers le cœur du radar.
 */
function footprintAt(p: RadarPoint, x: number, y: number, cx: number) {
  const label = p.nomCourt || p.ref
  const hasLabel = p.showLabel || !!p.nomCourt || !!p.ref
  const labelW = hasLabel ? (label.length + (p.critique ? 2 : 0)) * CHAR_W + LABEL_PAD : 0
  const top = y - POINT_R - 2, bottom = y + POINT_R + 2
  return x < cx
    ? { left: x - POINT_R - labelW, right: x + POINT_R, top, bottom }
    : { left: x - POINT_R, right: x + POINT_R + labelW, top, bottom }
}

function boxesOverlap(a: ReturnType<typeof footprintAt>, b: ReturnType<typeof footprintAt>): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

// Décalages candidats : position d'origine d'abord, puis spirale (anneaux × 12 angles).
function candidateOffsets(): [number, number][] {
  const out: [number, number][] = [[0, 0]]
  const step = 18
  for (let ring = 1; ring <= 5; ring++) {
    for (let a = 0; a < 360; a += 30) {
      const rad = (a * Math.PI) / 180
      out.push([Math.cos(rad) * step * ring, Math.sin(rad) * step * ring])
    }
  }
  return out
}

/**
 * Anti-chevauchement des PP connexes (rang ≥ 2) : déplace UNIQUEMENT les points
 * de rang 2/3 pour qu'ils ne recouvrent ni un autre point ni son libellé. Les
 * points de rang 1 (cartographie primaire, testée) restent fixes. Le lien
 * pointillé vers la parente suit la position finale (relation préservée).
 */
// Positions candidates pour un point de RANG 1 : rotations autour du centre à
// rayon ~constant (préserve la menace = le rayon), bornées à la zone « sûre » du
// secteur [centerDeg ± safeHalfDeg] (n'empiète pas sur les séparateurs) ; en
// dernier recours, léger décalage radial à angle (clampé) constant.
function angularCandidates(p: RadarPoint, geom: RadarGeometry, centerDeg: number, safeHalfDeg: number): [number, number][] {
  const dx = p.x - geom.cx, dy = p.y - geom.cy
  const r = Math.hypot(dx, dy)
  // Angle courant exprimé « depuis le haut, sens horaire » (cohérent avec polarToXY).
  const cur = (Math.atan2(dy, dx) * 180) / Math.PI + 90
  const lo = centerDeg - safeHalfDeg, hi = centerDeg + safeHalfDeg
  const at = (aDeg: number, rad = r): [number, number] => polarToXY(rad, clamp(aDeg, lo, hi), geom.cx, geom.cy)
  const out: [number, number][] = [at(cur)]
  const maxRot = Math.max(0, safeHalfDeg * 2)
  for (let step = 3; step <= maxRot + 3; step += 3) {
    out.push(at(cur + step)); out.push(at(cur - step))
  }
  // Repli radial : essentiel pour les points proches du centre (rotation quasi nulle
  // en absolu). On élargit l'amplitude pour séparer les amas du cœur (zone danger).
  for (const dr of [12, 24, 36, 48, -12, -24, 60]) {
    if (r + dr > 6) {
      out.push(at(cur, r + dr))
      // Combine rotation + décalage radial pour davantage de positions distinctes.
      out.push(at(cur + 8, r + dr)); out.push(at(cur - 8, r + dr))
    }
  }
  return out
}

/**
 * Dé-collision des points : déplace ceux qui se recouvrent (point OU libellé).
 * Ordre : rang croissant puis menace décroissante (les plus centraux d'abord).
 *  - RANG 1 : rotation à rayon ~constant dans son secteur (préserve la menace).
 *  - RANG ≥ 2 (PP connexes) : déplacement libre en spirale.
 * Le lien pointillé vers la parente suit la position finale (relation préservée).
 */
export function deOverlap(points: RadarPoint[], geom: RadarGeometry, spans: SectorSpan[]): void {
  if (points.length < 2) return
  const spanByType = new Map(spans.map(s => [s.type, s]))
  const order = [...points].sort((a, b) => a.rang - b.rang || b.menace - a.menace)
  const placed: RadarPoint[] = []
  for (const c of order) {
    const span = spanByType.get(c.type)
    const rNow = Math.hypot(c.x - geom.cx, c.y - geom.cy)
    const cands: [number, number][] = c.rang >= 2
      ? candidateOffsets().map(([dx, dy]) => [c.x + dx, c.y + dy] as [number, number])
      : angularCandidates(c, geom, span ? span.centerDeg : 0, span ? usableHalfAngle(rNow, span.widthDeg) : 30)
    let best: [number, number] | null = null
    let bestCollisions = Infinity
    for (const [nx, ny] of cands) {
      if (Math.hypot(nx - geom.cx, ny - geom.cy) > geom.rMax) continue
      const box = footprintAt(c, nx, ny, geom.cx)
      const collisions = placed.reduce((acc, q) => acc + (boxesOverlap(box, footprintAt(q, q.x, q.y, geom.cx)) ? 1 : 0), 0)
      if (collisions === 0) { best = [nx, ny]; bestCollisions = 0; break }
      if (collisions < bestCollisions) { bestCollisions = collisions; best = [nx, ny] }
    }
    if (best) { c.x = best[0]; c.y = best[1] }
    placed.push(c)
  }
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

  // Secteurs proportionnels au nombre de PP de chaque catégorie.
  const spans = sectorSpans(parties)
  const spanByType = new Map(spans.map(s => [s.type, s]))

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
    const span = spanByType.get(ty)!

    const group = perType.get(ty)!
    const k = group.length
    const posInGroup = group.indexOf(p)

    const m = menace(p.exposition ?? 1, p.fiabilite ?? 1, maxComposite)
    const r = radiusFor(m, geom.rMax, menaceMin, menaceMax)

    // Étalement symétrique autour du centre du secteur : une seule PP → centre exact.
    // L'étalement est borné par la marge « sûre » (fonction du diamètre du point et
    // de sa distance au centre) pour ne pas recouvrir les séparateurs de catégories.
    let angleDeg = span.centerDeg
    if (k > 1) {
      const halfSpread = usableHalfAngle(r, span.widthDeg)
      const ratio = posInGroup / (k - 1) // 0..1
      angleDeg = span.centerDeg - halfSpread + ratio * (2 * halfSpread)
    }

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
      rang: clamp(Math.round(p.rang ?? 1), 1, 3),
      cle: String(p.cle ?? ''),
      parentCle: String(p.parentCle ?? ''),
      showLabel: critique || zone === 'danger' || zone === 'controle',
      angleDeg,
      x,
      y,
    })
  })
  // Écarte les points qui se recouvrent (rang 1 : rotation à rayon ~constant pour
  // préserver la menace ; rang ≥ 2 : déplacement libre).
  deOverlap(points, geom, spans)
  return points
}
