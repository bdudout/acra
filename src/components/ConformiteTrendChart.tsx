'use client'

// Courbe « Historique & tendance » du taux de conformité : axe temporel réel,
// pourcentage affiché à chaque point, infobulle date + % au survol, et axe
// REPLIABLE (années passées repliées à l'année, dépliables en mois/trimestre/
// semestre ; année en cours dépliée). Géométrie pure : conformite-trend-axis.ts.

import { useMemo, useState } from 'react'
import { formatDate } from '@/lib/format'
import {
  buildSegments, pointX, minYearOf, type TrendGranularity, type TrendSegment,
} from '@/lib/conformite-trend-axis'

export interface TrendChartPoint { id: string; label: string | null; createdAt: string; taux: number }

const W = 680, H = 210, PAD_L = 32, PAD_R = 14, PAD_T = 18, PAD_B = 46
const INNER_W = W - PAD_L - PAD_R
const INNER_H = H - PAD_T - PAD_B

function colorFor(taux: number): string {
  return taux >= 80 ? '#16a34a' : taux >= 50 ? '#f59e0b' : '#ef4444'
}

export default function ConformiteTrendChart({ points, locale, granLabels, now: nowProp }: {
  points: TrendChartPoint[]
  locale: string
  granLabels: { month: string; quarter: string; semester: string; hint: string }
  /** Date « maintenant » injectable (tests) ; par défaut la date courante. */
  now?: Date
}) {
  const [gran, setGran] = useState<TrendGranularity>('month')
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set())
  const [hover, setHover] = useState<number | null>(null)

  const now = useMemo(() => nowProp ?? new Date(), [nowProp])
  // Points triés par date croissante (pour la ligne et les positions).
  const pts = useMemo(
    () => [...points].map(p => ({ ...p, ms: new Date(p.createdAt).getTime() })).sort((a, b) => a.ms - b.ms),
    [points],
  )
  const minYear = useMemo(() => minYearOf(pts.map(p => p.ms), now), [pts, now])
  const segs = useMemo(() => buildSegments(now, minYear, expanded, gran), [now, minYear, expanded, gran])

  const nSeg = segs.length || 1
  const xOf = (ms: number) => PAD_L + pointX(ms, segs) * INNER_W
  const yOf = (taux: number) => PAD_T + (1 - Math.min(100, Math.max(0, taux)) / 100) * INNER_H
  const segCenterX = (i: number) => PAD_L + ((i + 0.5) / nSeg) * INNER_W

  // Spans par année (pour la ligne des libellés d'année) : 1er et dernier index.
  const yearSpans = useMemo(() => {
    const m = new Map<number, { first: number; last: number; collapsed: boolean }>()
    segs.forEach((s, i) => {
      const cur = m.get(s.year)
      if (!cur) m.set(s.year, { first: i, last: i, collapsed: s.subIndex === null })
      else { cur.last = i; cur.collapsed = cur.collapsed && s.subIndex === null }
    })
    return m
  }, [segs])

  const toggleYear = (y: number) => {
    if (y === now.getFullYear()) return // l'année en cours reste dépliée
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(y)) next.delete(y); else next.add(y)
      return next
    })
  }

  const subLabel = (s: TrendSegment): string => {
    if (s.granularity === 'month') return new Date(s.start).toLocaleDateString(locale, { month: 'short' }).replace('.', '')
    if (s.granularity === 'quarter') return `T${(s.subIndex ?? 0) + 1}`
    if (s.granularity === 'semester') return `S${(s.subIndex ?? 0) + 1}`
    return ''
  }

  const last = pts.length ? pts[pts.length - 1].taux : 0
  const stroke = colorFor(last)
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.ms).toFixed(1)} ${yOf(p.taux).toFixed(1)}`).join(' ')

  const gradId = 'trend-grad'
  const grans: TrendGranularity[] = ['month', 'quarter', 'semester']

  return (
    <div>
      {/* Sélecteur de granularité */}
      <div className="mb-1.5 flex items-center gap-1">
        {grans.map(g => (
          <button key={g} type="button" onClick={() => setGran(g)}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${gran === g
              ? 'border-ebios-600 bg-ebios-600 text-white'
              : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
            {granLabels[g]}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-gray-400">{granLabels.hint}</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${last}%`} className="overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Grille horizontale + graduation % */}
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={PAD_L} y1={yOf(v)} x2={W - PAD_R} y2={yOf(v)}
              className="stroke-gray-100 dark:stroke-gray-700" strokeWidth={1} strokeDasharray={v === 0 || v === 100 ? undefined : '3 3'} />
            <text x={PAD_L - 5} y={yOf(v) + 3} textAnchor="end" fontSize={9} className="fill-gray-400 dark:fill-gray-500 tabular-nums">{v}</text>
          </g>
        ))}

        {/* Séparateurs verticaux de segments */}
        {segs.map((s, i) => i > 0 && (
          <line key={`sep${s.key}`} x1={PAD_L + (i / nSeg) * INNER_W} y1={PAD_T} x2={PAD_L + (i / nSeg) * INNER_W} y2={PAD_T + INNER_H}
            className="stroke-gray-50 dark:stroke-gray-800" strokeWidth={1} />
        ))}

        {/* Aire + ligne de tendance */}
        {pts.length > 1 && <path d={`${line} L ${xOf(pts[pts.length - 1].ms).toFixed(1)} ${PAD_T + INNER_H} L ${xOf(pts[0].ms).toFixed(1)} ${PAD_T + INNER_H} Z`} fill={`url(#${gradId})`} />}
        {pts.length > 1 && <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}

        {/* Points + pourcentage au-dessus */}
        {pts.map((p, i) => {
          const cx = xOf(p.ms), cy = yOf(p.taux)
          const on = hover === i
          return (
            <g key={p.id + i}>
              <circle cx={cx} cy={cy} r={on ? 4.5 : 3} fill={colorFor(p.taux)} stroke="#fff" strokeWidth={1.5}
                className="cursor-pointer" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
              <text x={cx} y={cy - 8} textAnchor="middle" fontSize={9} fontWeight={700}
                strokeWidth={2.5} paintOrder="stroke"
                className="fill-gray-800 [stroke:#fff] dark:fill-gray-100 dark:[stroke:#0f172a] tabular-nums pointer-events-none">{p.taux}%</text>
            </g>
          )
        })}

        {/* Ligne 1 — libellés de sous-période (mois/trimestre/semestre) */}
        {segs.map((s, i) => s.subIndex !== null && (
          <text key={`sub${s.key}`} x={segCenterX(i)} y={PAD_T + INNER_H + 13} textAnchor="middle" fontSize={8.5}
            className="fill-gray-500 dark:fill-gray-400">{subLabel(s)}</text>
        ))}

        {/* Ligne 2 — libellés d'année (repliable : ▸ replié = cliquable pour déplier,
            ▾ déplié passé = cliquable pour replier ; année en cours non cliquable) */}
        {[...yearSpans.entries()].map(([year, span]) => {
          const cx = (segCenterX(span.first) + segCenterX(span.last)) / 2
          const isCurrent = year === now.getFullYear()
          const clickable = !isCurrent
          const caret = span.collapsed ? '▸ ' : isCurrent ? '' : '▾ '
          return (
            <text key={`yr${year}`} x={cx} y={PAD_T + INNER_H + 30} textAnchor="middle" fontSize={9.5} fontWeight={600}
              onClick={clickable ? () => toggleYear(year) : undefined}
              className={clickable
                ? 'fill-ebios-700 dark:fill-ebios-300 cursor-pointer underline'
                : 'fill-gray-600 dark:fill-gray-300'}>
              {caret}{year}
            </text>
          )
        })}

        {/* Infobulle au survol : date + % */}
        {hover !== null && pts[hover] && (() => {
          const p = pts[hover]
          const cx = xOf(p.ms), cy = yOf(p.taux)
          const tipW = 118, tipH = 30
          let tx = cx + 8
          if (tx + tipW > W - PAD_R) tx = cx - tipW - 8
          tx = Math.max(2, Math.min(tx, W - tipW - 2))
          const ty = Math.max(2, cy - tipH - 8)
          return (
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={tipW} height={tipH} rx={4}
                className="fill-white dark:fill-gray-800" stroke={colorFor(p.taux)} strokeWidth={1} />
              <text x={tx + 7} y={ty + 12} fontSize={9} className="fill-gray-500 dark:fill-gray-400">{formatDate(p.createdAt, locale)}</text>
              <text x={tx + 7} y={ty + 23} fontSize={10} fontWeight={700} className="fill-gray-800 dark:fill-gray-100 tabular-nums">{p.taux}%{p.label ? ` · ${p.label}` : ''}</text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}
