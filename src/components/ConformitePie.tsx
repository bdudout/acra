import type { ConformiteStats } from '@/lib/conformite'

interface Props {
  stats: ConformiteStats
  frameworkNom: string
  title: string
  rateLabel: string            // ex. « conforme »
  labels: { conforme: string; partiel: string; non_conforme: string; na: string }
  /** Note optionnelle (ex. « hérité du socle X »). */
  note?: string | null
}

const R = 42
const STROKE = 16
const C = 2 * Math.PI * R

const SEGS: { key: keyof Pick<ConformiteStats, 'conforme' | 'partiel' | 'nonConforme' | 'na'>; color: string; labelKey: keyof Props['labels'] }[] = [
  { key: 'conforme',    color: '#22c55e', labelKey: 'conforme' },
  { key: 'partiel',     color: '#fbbf24', labelKey: 'partiel' },
  { key: 'nonConforme', color: '#ef4444', labelKey: 'non_conforme' },
  { key: 'na',          color: '#d1d5db', labelKey: 'na' },
]

/**
 * Camembert (donut) de conformité au référentiel : répartition
 * conforme / partiel / non conforme / NA, taux de conformité au centre.
 * Présentational (pas de hooks) — labels fournis par l'appelant (i18n).
 */
export default function ConformitePie({ stats, frameworkNom, title, rateLabel, labels, note }: Props) {
  const total = stats.evalues || 0
  let acc = 0

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-gray-800 mb-1">🛡️ {title}</h2>
      <p className="text-xs text-gray-500 mb-3">{frameworkNom}{note ? ` · ${note}` : ''}</p>
      <div className="flex items-center gap-5 flex-wrap">
        <div className="relative" style={{ width: 120, height: 120 }}>
          <svg viewBox="0 0 120 120" width={120} height={120} role="img" aria-label={`${stats.tauxConformite}% ${rateLabel}`}>
            <circle cx={60} cy={60} r={R} fill="none" stroke="#f3f4f6" strokeWidth={STROKE} />
            {total > 0 && SEGS.map(seg => {
              const n = stats[seg.key] as number
              if (n <= 0) return null
              const len = (n / total) * C
              const el = (
                <circle
                  key={seg.key}
                  cx={60} cy={60} r={R}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-acc}
                  transform="rotate(-90 60 60)"
                />
              )
              acc += len
              return el
            })}
            <text x={60} y={57} textAnchor="middle" className="fill-gray-800" style={{ fontSize: 22, fontWeight: 700 }}>{stats.tauxConformite}%</text>
            <text x={60} y={73} textAnchor="middle" className="fill-gray-400" style={{ fontSize: 9 }}>{rateLabel}</text>
          </svg>
        </div>
        <ul className="text-xs space-y-1.5 min-w-[140px]">
          {SEGS.map(seg => (
            <li key={seg.key} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="text-gray-600 flex-1">{labels[seg.labelKey]}</span>
              <span className="font-semibold text-gray-800">{stats[seg.key] as number}</span>
            </li>
          ))}
          <li className="flex items-center gap-2 pt-1 border-t border-gray-100 text-gray-400">
            <span className="flex-1">{stats.evalues}/{stats.total}</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
