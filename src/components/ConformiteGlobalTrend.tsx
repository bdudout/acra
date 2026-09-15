import { TrendingUp } from 'lucide-react'
import type { Locale } from '@/lib/i18n'
import type { TrendPoint } from '@/lib/conformite-trend'
import ConformiteTrendChart from '@/components/ConformiteTrendChart'

/**
 * Historique & tendance de la conformité GLOBALE (tous référentiels), sur la vue
 * conformité. Réutilise la MÊME visualisation que la conformité détaillée
 * (ConformiteTrendChart : axe temporel repliable, % aux points, infobulle) pour
 * une lecture cohérente ; conserve l'en-tête de synthèse premier → dernier.
 */
export default function ConformiteGlobalTrend({ points, locale, title, granLabels }: {
  points: TrendPoint[]
  locale: Locale
  title: string
  granLabels: { month: string; quarter: string; semester: string; hint: string }
}) {
  if (points.length < 2) return null
  const last = points[points.length - 1].taux
  const first = points[0].taux
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
      <ConformiteTrendChart
        points={points.map((p, i) => ({ id: `${p.date}-${i}`, label: null, createdAt: p.date, taux: p.taux }))}
        locale={locale}
        granLabels={granLabels}
      />
    </div>
  )
}
