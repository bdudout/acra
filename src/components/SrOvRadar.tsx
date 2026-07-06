import { srOvCouples, couplePoint, coupleRadiusFor, type SrOvCouple } from '@/lib/sr-ov-radar'

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

const SIZE = 320
const CX = SIZE / 2
const CY = SIZE / 2
const RMAX = 132

/**
 * Cartographie de type radar des couples SR/OV (EXI_M2_09) : chaque couple source
 * de risque / objectif visé est un point, coloré par catégorie de source ; plus il
 * est central, plus il est pertinent (prioritaire). Les couples P1 sont accentués.
 */
export default function SrOvRadar({ sources, labels, pertinenceLabel, categoryLabels }: {
  sources: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
  labels: { empty: string; p1: string; pertinence1: string; pertinence4: string }
  pertinenceLabel: string
  categoryLabels: Record<string, string>
}) {
  const couples: SrOvCouple[] = srOvCouples(sources)
  const geom = { cx: CX, cy: CY, rMax: RMAX }

  if (couples.length === 0) {
    return <p className="text-sm text-gray-400">{labels.empty}</p>
  }

  // Catégories présentes (pour la légende).
  const cats = Array.from(new Set(couples.map(c => c.categorie)))

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[320px] flex-shrink-0" role="img" aria-label={pertinenceLabel}>
        {/* Anneaux de pertinence (4 = centre, 1 = périphérie) */}
        {[1, 2, 3, 4].map(p => (
          <circle key={p} cx={CX} cy={CY} r={coupleRadiusFor(p, RMAX)} fill="none" stroke="#e5e7eb" strokeWidth={1} />
        ))}
        {/* Axes */}
        <line x1={CX} y1={CY - RMAX} x2={CX} y2={CY + RMAX} stroke="#f3f4f6" strokeWidth={1} />
        <line x1={CX - RMAX} y1={CY} x2={CX + RMAX} y2={CY} stroke="#f3f4f6" strokeWidth={1} />
        {/* Repères de pertinence (centre = forte, périphérie = faible) */}
        <text x={CX + 4} y={CY - coupleRadiusFor(4, RMAX) - 2} fontSize={8} fill="#9ca3af">{pertinenceLabel} {labels.pertinence4}</text>
        <text x={CX + 4} y={CY - coupleRadiusFor(1, RMAX) + 12} fontSize={8} fill="#9ca3af">{pertinenceLabel} {labels.pertinence1}</text>

        {/* Points : un par couple SR/OV */}
        {couples.map((c, i) => {
          const { x, y } = couplePoint(i, couples.length, c.pertinence, geom)
          const isP1 = c.priorite === 'P1'
          return (
            <g key={c.id}>
              <circle
                cx={x} cy={y} r={isP1 ? 6 : 4}
                fill={hexFor(c.categorie)}
                stroke={isP1 ? '#111827' : '#ffffff'}
                strokeWidth={isP1 ? 1.5 : 1}
              >
                <title>{`${c.sourceNom} → ${c.ovNom} — ${pertinenceLabel} ${c.pertinence}/4${isP1 ? ` (${labels.p1})` : ''}`}</title>
              </circle>
            </g>
          )
        })}
      </svg>

      {/* Légende */}
      <ul className="text-xs space-y-1">
        {cats.map(cat => (
          <li key={cat} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: hexFor(cat) }} aria-hidden />
            <span className="text-gray-700">{categoryLabels[cat] ?? cat}</span>
            <span className="text-gray-400">({couples.filter(c => c.categorie === cat).length})</span>
          </li>
        ))}
        <li className="flex items-center gap-2 pt-1">
          <span className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-gray-900" aria-hidden />
          <span className="text-gray-500">{labels.p1}</span>
        </li>
      </ul>
    </div>
  )
}
