import { TrendingUp } from 'lucide-react'
import { formatDate } from '@/lib/format'
import type { Locale } from '@/lib/i18n'
import type { TrendPoint } from '@/lib/conformite-trend'

/**
 * Historique & tendance de la conformité GLOBALE (tous référentiels), sous les
 * cadrans du dashboard. Présentational (SVG inline, thème clair/sombre), rendu
 * côté serveur — la série « as-of » est calculée par globalConformiteTrend.
 */
export default function ConformiteGlobalTrend({ points, locale, title }: {
  points: TrendPoint[]
  locale: Locale
  title: string
}) {
  if (points.length < 2) return null
  const W = 640, H = 90, P = 8
  const n = points.length
  const xs = (i: number) => P + (i * (W - 2 * P)) / (n - 1)
  const ys = (v: number) => H - P - (v / 100) * (H - 2 * P)
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xs(i).toFixed(1)} ${ys(p.taux).toFixed(1)}`).join(' ')
  const area = `${line} L ${xs(n - 1).toFixed(1)} ${H - P} L ${xs(0).toFixed(1)} ${H - P} Z`
  const last = points[n - 1].taux
  const first = points[0].taux
  const stroke = last >= 80 ? '#16a34a' : last >= 50 ? '#f59e0b' : '#ef4444'
  const delta = last - first

  return (
    <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
          <TrendingUp size={15} aria-hidden="true" /> {title}
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
          {first}% → <span className="font-semibold text-gray-800 dark:text-gray-100">{last}%</span>
          <span className={delta > 0 ? 'text-green-600 dark:text-green-400 ml-1.5' : delta < 0 ? 'text-red-600 dark:text-red-400 ml-1.5' : 'text-gray-400 ml-1.5'}>
            {delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {delta > 0 ? '+' : ''}{delta}
          </span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label={`${last}%`} className="min-w-[320px]">
          <line x1={P} y1={ys(50)} x2={W - P} y2={ys(50)} className="stroke-gray-100 dark:stroke-gray-700" strokeWidth={1} strokeDasharray="3 3" />
          <path d={area} fill={stroke} opacity={0.08} />
          <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => <circle key={i} cx={xs(i)} cy={ys(p.taux)} r={i === n - 1 ? 3 : 2} fill={stroke} />)}
        </svg>
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
        <span>{formatDate(points[0].date, locale)}</span>
        <span>{formatDate(points[n - 1].date, locale)}</span>
      </div>
    </div>
  )
}
