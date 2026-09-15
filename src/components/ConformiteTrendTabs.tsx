'use client'

// Historique & tendance de la conformité : un onglet « Global » (agrégat de tous
// les référentiels, une seule courbe) + un onglet par référentiel (graphe dédié)
// — pour ne pas empiler plusieurs courbes sur le même graphique. Réutilise la
// visualisation détaillée (ConformiteTrendChart : axe repliable, % aux points,
// infobulle). Sans onglets si un seul référentiel.

import { useState } from 'react'
import { TrendingUp } from 'lucide-react'
import type { Locale } from '@/lib/i18n'
import type { TrendPoint } from '@/lib/conformite-trend'
import ConformiteTrendChart from '@/components/ConformiteTrendChart'

export interface TrendSeries { key: string; label: string; points: TrendPoint[] }

export default function ConformiteTrendTabs({ series, locale, title, granLabels }: {
  series: TrendSeries[]
  locale: Locale
  title: string
  granLabels: { month: string; quarter: string; semester: string; hint: string }
}) {
  const usable = series.filter(s => s.points.length >= 2)
  const [active, setActive] = useState(0)
  if (usable.length === 0) return null
  const idx = Math.min(active, usable.length - 1)
  const cur = usable[idx]
  const first = cur.points[0].taux
  const last = cur.points[cur.points.length - 1].taux
  const delta = last - first

  return (
    <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
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

      {usable.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1 border-b border-gray-100 dark:border-gray-700">
          {usable.map((s, i) => (
            <button key={s.key} type="button" onClick={() => setActive(i)}
              className={`px-2.5 py-1 text-xs font-medium -mb-px border-b-2 ${i === idx
                ? 'border-ebios-600 text-ebios-700 dark:text-ebios-300'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      <ConformiteTrendChart
        key={cur.key}
        points={cur.points.map((p, i) => ({ id: `${p.date}-${i}`, label: null, createdAt: p.date, taux: p.taux }))}
        locale={locale}
        granLabels={granLabels}
      />
    </div>
  )
}
