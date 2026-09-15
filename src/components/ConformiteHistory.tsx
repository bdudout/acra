'use client'

import { Pin, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { formatDate } from '@/lib/format'
import ConformiteTrendChart from '@/components/ConformiteTrendChart'

interface Point { id: string; label: string | null; createdAt: string; taux: number; evalues: number; total: number }

/**
 * Historique & tendance du taux de conformité d'une entité org × référentiel
 * (Palier 3). Chargé à la demande via GET /api/organizations/[orgId]/conformite.
 * Permet de figer une version (POST) si l'utilisateur a le droit.
 */
export default function ConformiteHistory({ orgId, referentiel, entite = '', locale, canEdit }: {
  orgId: string; referentiel: string; entite?: string; locale: string; canEdit: boolean
}) {
  const qEntite = `&entite=${encodeURIComponent(entite)}`
  const { t } = useTranslation()
  const d = t.dashboard as unknown as Record<string, string>
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState<{ current: Point | null; snapshots: Point[] } | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/organizations/${orgId}/conformite?referentiel=${encodeURIComponent(referentiel)}${qEntite}`)
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
        body: JSON.stringify({ referentiel, entite, label }),
      })
      if (res.ok) await load()
    } catch { /* silencieux */ } finally { setBusy(false) }
  }

  // Série = snapshots (historiques) + point courant.
  const series: Point[] = data ? [...data.snapshots, ...(data.current ? [{ ...data.current, label: d.conformiteCurrentPoint }] : [])] : []

  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <button type="button" onClick={toggle} className="text-xs text-gray-600 hover:text-gray-900 font-medium">
        {open ? '▾' : '▸'} <TrendingUp size={14} className="inline align-[-0.15em] mr-1" aria-hidden="true" />{d.conformiteHistoryToggle}
      </button>
      {open && (
        <div className="mt-2">
          {loading && <p className="text-xs text-gray-400">…</p>}
          {!loading && series.length > 0 && (
            <>
              <ConformiteTrendChart
                points={series.map(p => ({ id: p.id, label: p.label, createdAt: p.createdAt, taux: p.taux }))}
                locale={locale}
                granLabels={{ month: d.conformiteGranMonth, quarter: d.conformiteGranQuarter, semester: d.conformiteGranSemester, hint: d.conformiteGranHint }}
              />
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
              <Pin size={15} className="inline align-[-0.15em] mr-1.5" aria-hidden="true" /> {d.conformiteFreeze}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
