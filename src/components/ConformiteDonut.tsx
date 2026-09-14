import { donutSegments } from '@/lib/donut'

export interface ConformiteDonutLabels {
  conforme: string
  partiel: string
  nonConforme: string
  na: string
  /** Libellé sous le taux central, ex. « conforme ». */
  centerHint: string
}

/**
 * Camembert « donut » de conformité : répartition conforme / partiel / non
 * conforme / non applicable, avec le taux de conformité au centre. Purement
 * présentational (SVG inline, aucune dépendance). Le taux central =
 * conforme / (conforme + partiel + non conforme).
 */
export default function ConformiteDonut({ conforme, partiel, nonConforme, na, taux, labels, size = 132 }: {
  conforme: number
  partiel: number
  nonConforme: number
  na: number
  taux: number
  labels: ConformiteDonutLabels
  size?: number
}) {
  const stroke = 16
  const r = (size - stroke) / 2
  const C = 2 * Math.PI * r
  const parts = [
    { key: 'conforme', value: conforme, color: '#16a34a', label: labels.conforme },
    { key: 'partiel', value: partiel, color: '#f59e0b', label: labels.partiel },
    { key: 'nonConforme', value: nonConforme, color: '#dc2626', label: labels.nonConforme },
    { key: 'na', value: na, color: '#cbd5e1', label: labels.na },
  ]
  const { total, segments } = donutSegments(parts, C)
  const labelByKey = new Map(parts.map(p => [p.key, p.label]))

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
        aria-label={`${labels.centerHint} ${taux}%`} className="shrink-0">
        {/* Anneau de fond (piste) */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef2f7" strokeWidth={stroke} />
        {/* Segments — rotation -90° pour démarrer à midi */}
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map(s => s.len > 0 && (
            <circle key={s.key} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${s.len} ${s.gap}`} strokeDashoffset={s.offset} />
          ))}
        </g>
        <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle"
          className="fill-gray-900 font-bold" style={{ fontSize: 26 }}>{taux}%</text>
        <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle"
          className="fill-gray-400" style={{ fontSize: 11 }}>{labels.centerHint}</text>
      </svg>

      <ul className="text-sm space-y-1.5">
        {segments.map(s => (
          <li key={s.key} className="flex items-center gap-2 text-gray-600">
            <span className="inline-block h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} aria-hidden="true" />
            <span className="text-gray-700">{labelByKey.get(s.key)}</span>
            <span className="ml-auto tabular-nums font-medium text-gray-900">{s.value}</span>
            <span className="tabular-nums text-gray-400 w-10 text-right">{total > 0 ? `${s.pct}%` : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
