import {
  srOvCouples, coupleRadiusFor, categoriesInOrder, couplePointSector,
  sectorLabelPoint, sectorCenterAngle, type SrOvCouple,
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

// Repère plus grand + marge pour les libellés de catégorie en périphérie.
const SIZE = 300
const PAD = 58
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
  labels: { empty: string; p1: string; pertinence1: string; pertinence4: string }
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
  const seen: Record<string, number> = {}
  const placed = couples.map(c => {
    const i = seen[c.categorie] ?? 0
    seen[c.categorie] = i + 1
    localIndex.set(c.id, i)
    const ci = cats.indexOf(c.categorie)
    return { c, ...couplePointSector(ci, nCats, i, localCount.get(c.categorie) ?? 1, c.pertinence, GEOM) }
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

          {/* Libellés de catégorie en périphérie de chaque secteur */}
          {cats.map((cat, ci) => {
            const { x, y, anchor } = sectorLabelPoint(ci, nCats, GEOM, 20)
            return (
              <g key={cat}>
                <circle cx={anchor === 'end' ? x + 6 : anchor === 'start' ? x - 6 : x} cy={y - 3} r={3} fill={hexFor(cat)} />
                <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle"
                  className="fill-gray-600 dark:fill-gray-300" fontSize={11} fontWeight={600}>
                  {categoryLabels[cat] ?? cat}
                </text>
              </g>
            )
          })}

          {/* Repère radial de pertinence, le long de l'axe vertical haut */}
          <text x={CX} y={CY - rInner + 12} textAnchor="middle" className="fill-ebios-600 dark:fill-ebios-300" fontSize={9} fontWeight={600}>
            {labels.pertinence4}
          </text>
          <text x={CX} y={CY - RMAX + 12} textAnchor="middle" className="fill-gray-400 dark:fill-gray-500" fontSize={9}>
            {labels.pertinence1}
          </text>

          {/* Points : un par couple SR/OV */}
          {placed.map(({ c, x, y }) => {
            const isP1 = c.priorite === 'P1'
            return (
              <g key={c.id}>
                {isP1 && <circle cx={x} cy={y} r={10} fill={hexFor(c.categorie)} opacity={0.18} />}
                <circle cx={x} cy={y} r={isP1 ? 6 : 4} fill={hexFor(c.categorie)}
                  stroke={isP1 ? '#111827' : '#ffffff'} strokeWidth={isP1 ? 1.5 : 1}
                  className={isP1 ? 'dark:[stroke:#f9fafb]' : ''}>
                  <title>{`${c.sourceNom} → ${c.ovNom} — ${pertinenceLabel} ${c.pertinence}/4${isP1 ? ` (${labels.p1})` : ''}`}</title>
                </circle>
                {isP1 && (
                  <text x={x + 8} y={y + 3} className="fill-gray-700 dark:fill-gray-200" fontSize={9} fontWeight={600}>
                    {c.ovNom.length > 22 ? c.ovNom.slice(0, 21) + '…' : c.ovNom}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Légende */}
      <ul className="text-xs space-y-1">
        {cats.map(cat => (
          <li key={cat} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: hexFor(cat) }} aria-hidden />
            <span className="text-gray-700 dark:text-gray-200">{categoryLabels[cat] ?? cat}</span>
            <span className="text-gray-400 dark:text-gray-500">({couples.filter(c => c.categorie === cat).length})</span>
          </li>
        ))}
        <li className="flex items-center gap-2 pt-1">
          <span className="w-3.5 h-3.5 rounded-full flex-shrink-0 border-2 border-gray-900 dark:border-gray-100" aria-hidden />
          <span className="text-gray-500 dark:text-gray-400">{labels.p1}</span>
        </li>
      </ul>
    </div>
  )
}
