'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { formatDate } from '@/lib/format'

interface Point { id: string; label: string | null; createdAt: string; taux: number; evalues: number; total: number }

/**
 * Historique & tendance du taux de conformité d'une entité org × référentiel
 * (Palier 3). Chargé à la demande via GET /api/organizations/[orgId]/conformite.
 * Permet de figer une version (POST) si l'utilisateur a le droit.
 */
export default function ConformiteHistory({ orgId, referentiel, locale, canEdit }: {
  orgId: string; referentiel: string; locale: string; canEdit: boolean
}) {
  const { t } = useTranslation()
  const d = t.dashboard as unknown as Record<string, string>
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState<{ current: Point | null; snapshots: Point[] } | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/organizations/${orgId}/conformite?referentiel=${encodeURIComponent(referentiel)}`)
      if (res.ok) setData(await res.json())
    } catch { /* silencieux */ } finally { setLoading(false) }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && !data) load()
  }

  async function freeze() {
    const label = window.prompt(d.conformiteFreezePrompt) ?? undefined
    if (label === undefined) return // annulé
    setBusy(true)
    try {
      const res = await fetch(`/api/organizations/${orgId}/conformite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referentiel, label }),
      })
      if (res.ok) await load()
    } catch { /* silencieux */ } finally { setBusy(false) }
  }

  // Série = snapshots (historiques) + point courant.
  const series: Point[] = data ? [...data.snapshots, ...(data.current ? [{ ...data.current, label: d.conformiteCurrentPoint }] : [])] : []

  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <button type="button" onClick={toggle} className="text-xs text-gray-600 hover:text-gray-900 font-medium">
        {open ? '▾' : '▸'} 📈 {d.conformiteHistoryToggle}
      </button>
      {open && (
        <div className="mt-2">
          {loading && <p className="text-xs text-gray-400">…</p>}
          {!loading && series.length > 0 && (
            <>
              <Sparkline points={series.map(p => p.taux)} />
              <ul className="mt-2 space-y-1">
                {[...series].reverse().map((p, i) => (
                  <li key={p.id + i} className="flex items-center justify-between gap-2 text-[11px] text-gray-600">
                    <span className="truncate">{p.label || formatDate(p.createdAt, locale)}</span>
                    <span className="text-gray-400 flex-shrink-0">{formatDate(p.createdAt, locale)} · <span className="font-semibold text-gray-700">{p.taux}%</span></span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {!loading && series.length === 0 && <p className="text-xs text-gray-400">{d.conformiteNoHistory}</p>}
          {canEdit && (
            <button
              type="button"
              onClick={freeze}
              disabled={busy}
              className="mt-2 text-[11px] rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              📌 {d.conformiteFreeze}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Mini-courbe SVG (taux 0–100) — tendance dans le temps. */
function Sparkline({ points }: { points: number[] }) {
  const W = 240, H = 44, P = 4
  if (points.length === 0) return null
  const n = points.length
  const x = (i: number) => n === 1 ? W / 2 : P + (i * (W - 2 * P)) / (n - 1)
  const y = (v: number) => H - P - (v / 100) * (H - 2 * P)
  const line = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const last = points[n - 1]
  const color = last >= 80 ? '#22c55e' : last >= 50 ? '#fbbf24' : '#ef4444'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`${last}%`}>
      <line x1={P} y1={y(50)} x2={W - P} y2={y(50)} stroke="#f3f4f6" strokeWidth={1} />
      {points.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />}
      {points.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === n - 1 ? 2.5 : 1.5} fill={color} />)}
    </svg>
  )
}
