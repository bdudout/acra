import {
  srOvCouples, coupleRadiusFor, categoriesInOrder, couplePointSector,
  sectorCenterAngle, type SrOvCouple,
} from '@/lib/sr-ov-radar'

// Couleurs (hex) par catégorie de source — cohérentes avec CATEGORY_COLORS d'Atelier2.
const CAT_HEX: Record<string, string> = {
  CYBERCRIMINEL:       '#dc2626',
  ETAT_NATION:         '#7c3aed',
  CONCURRENT:          '#ea580c',
  ACTIVISTE:           '#ca8a04',
  EMPLOYE_MALVEILLANT: '#e11d48',
  PRESTATAIRE:         '#2563eb',
  AMATEUR:             '#6b7280',
  TERRORISTE:          '#991b1b',
  AUTRE:               '#6b7280',
}
const hexFor = (cat: string) => CAT_HEX[cat] ?? '#6b7280'

// Marge modérée (les libellés de catégorie ne sont plus dans le SVG → pas de
// débordement ; l'identification se fait par la liste numérotée à droite).
const SIZE = 300
const PAD = 22
const VB = SIZE + PAD * 2
const CX = VB / 2
const CY = VB / 2
const RMAX = SIZE / 2 - 6
const GEOM = { cx: CX, cy: CY, rMax: RMAX }

/**
 * Cartographie « cible » des couples SR/OV (EXI_M2_09). Améliorations UX :
 *  - le RAYON encode la pertinence (centre = prioritaire) ;
 *  - l'ANGLE encode la CATÉGORIE de source (un secteur + un libellé par catégorie)
 *    → la position devient lisible et les couples d'une même source sont regroupés ;
 *  - la zone centrale (prioritaire) est teintée ; les couples P1 sont fortement
 *    accentués (halo + anneau + nom) ; rendu compatible thème sombre.
 */
export default function SrOvRadar({ sources, labels, pertinenceLabel, categoryLabels }: {
  sources: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
  labels: { empty: string; p1: string; pertinence1: string; pertinence4: string; couplesTitle: string; hint: string }
  pertinenceLabel: string
  categoryLabels: Record<string, string>
}) {
  const couples: SrOvCouple[] = srOvCouples(sources)

  if (couples.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">{labels.empty}</p>
  }

  const cats = categoriesInOrder(couples)
  const nCats = cats.length
  // Rang local de chaque couple au sein de sa catégorie (pour la répartition angulaire).
  const localIndex = new Map<string, number>()
  const localCount = new Map<string, number>()
  for (const cat of cats) localCount.set(cat, couples.filter(c => c.categorie === cat).length)
  // Ordre stable : par catégorie (regroupe les couples d'une même source), puis
  // par pertinence décroissante. Ce rang donne le NUMÉRO affiché (point + liste).
  const ordered = [...couples].sort((a, b) => {
    const ca = cats.indexOf(a.categorie) - cats.indexOf(b.categorie)
    return ca !== 0 ? ca : b.pertinence - a.pertinence
  })
  const numById = new Map<string, number>()
  ordered.forEach((c, i) => numById.set(c.id, i + 1))

  const seen: Record<string, number> = {}
  const placed = couples.map(c => {
    const i = seen[c.categorie] ?? 0
    seen[c.categorie] = i + 1
    localIndex.set(c.id, i)
    const ci = cats.indexOf(c.categorie)
    return { c, num: numById.get(c.id) ?? 0, ...couplePointSector(ci, nCats, i, localCount.get(c.categorie) ?? 1, c.pertinence, GEOM) }
  })
  // P1 dessinés en dernier (au-dessus).
  placed.sort((a, b) => (a.c.priorite === 'P1' ? 1 : 0) - (b.c.priorite === 'P1' ? 1 : 0))

  const rInner = coupleRadiusFor(4, RMAX) // limite de la zone prioritaire (pertinence 4)

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start">
      <div className="text-gray-300 dark:text-gray-600 w-full max-w-[380px] flex-shrink-0">
        <svg viewBox={`0 0 ${VB} ${VB}`} className="w-full" role="img" aria-label={pertinenceLabel}>
          {/* Zone centrale prioritaire (pertinence forte) */}
          <circle cx={CX} cy={CY} r={rInner} className="fill-ebios-500/10 dark:fill-ebios-400/10" />
          {/* Anneaux de pertinence */}
          {[1, 2, 3, 4].map(p => (
            <circle key={p} cx={CX} cy={CY} r={coupleRadiusFor(p, RMAX)} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.5} />
          ))}
          {/* Séparateurs de secteurs (entre catégories) */}
          {nCats > 1 && cats.map((_, ci) => {
            const a = sectorCenterAngle(ci, nCats) - Math.PI / nCats // bord du secteur
            return (
              <line key={ci} x1={CX} y1={CY}
                x2={CX + RMAX * Math.sin(a)} y2={CY - RMAX * Math.cos(a)}
                stroke="currentColor" strokeWidth={1} opacity={0.35} />
            )
          })}

          {/* Repère radial de pertinence, le long de l'axe vertical haut */}
          <text x={CX} y={CY - rInner + 12} textAnchor="middle" className="fill-ebios-600 dark:fill-ebios-300" fontSize={9} fontWeight={600}>
            {labels.pertinence4}
          </text>
          <text x={CX} y={CY - RMAX + 11} textAnchor="middle" className="fill-gray-400 dark:fill-gray-500" fontSize={9}>
            {labels.pertinence1}
          </text>

          {/* Points : un par couple SR/OV, numéroté (renvoie à la liste à droite) */}
          {placed.map(({ c, x, y, num }) => {
            const isP1 = c.priorite === 'P1'
            return (
              <g key={c.id}>
                {isP1 && <circle cx={x} cy={y} r={10} fill={hexFor(c.categorie)} opacity={0.18} />}
                <circle cx={x} cy={y} r={isP1 ? 6.5 : 5} fill={hexFor(c.categorie)}
                  stroke={isP1 ? '#111827' : '#ffffff'} strokeWidth={isP1 ? 1.5 : 1}
                  className={isP1 ? 'dark:[stroke:#f9fafb]' : ''}>
                  <title>{`${num}. ${c.sourceNom} → ${c.ovNom} — ${pertinenceLabel} ${c.pertinence}/4${isP1 ? ` (${labels.p1})` : ''}`}</title>
                </circle>
                <text x={x} y={y - (isP1 ? 9 : 8)} textAnchor="middle"
                  className="fill-gray-600 dark:fill-gray-300" fontSize={9} fontWeight={700}>{num}</text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Liste numérotée : chaque point = un couple source → objectif visé.
          Lève l'ambiguïté entre deux couples d'une même catégorie (recette). */}
      <div className="text-xs space-y-2 min-w-0">
        <div>
          <p className="font-semibold text-gray-700 dark:text-gray-200">{labels.couplesTitle} ({couples.length})</p>
          <p className="text-gray-400 dark:text-gray-500">{labels.hint}</p>
        </div>
        <ol className="space-y-1">
          {ordered.map(c => (
            <li key={c.id} className="flex items-start gap-2">
              <span className="w-4 text-right tabular-nums text-gray-400 dark:text-gray-500 flex-shrink-0">{numById.get(c.id)}</span>
              <span className="w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: hexFor(c.categorie) }} aria-hidden />
              <span className="text-gray-700 dark:text-gray-200">
                <span className="text-gray-500 dark:text-gray-400">{c.sourceNom || (categoryLabels[c.categorie] ?? c.categorie)}</span>
                {' → '}{c.ovNom}
                {c.priorite === 'P1' && (
                  <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-ebios-100 text-ebios-700 dark:bg-ebios-500/20 dark:text-ebios-300 font-medium">{labels.p1}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
