'use client'

// ─── Configuration : secteurs d'activité de l'organisation (ADMIN) ────────────
// Jusqu'à trois secteurs, le premier étant le principal (proposé par défaut dans les suggestions de processus et de risques).
// Déclarer un secteur ne crée aucune donnée : les suggestions restent validées une à une.

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { MAX_SECTORS, moveSector, toggleSector } from '@/lib/sector-selection'

export default function SectorSettings() {
  const { t } = useTranslation()
  const c = t.sectorSettings
  const names = t.sectorSuggestions.sectors as Record<string, string>
  const [available, setAvailable] = useState<string[] | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/catalogue-suggestions/sectors').then(r => r.ok ? r.json() : null).then(data => {
      if (cancelled || !data) return
      setAvailable(Array.isArray(data.available) ? data.available : []); setSelected(Array.isArray(data.sectors) ? data.sectors : [])
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (available === null) return null // lecture seule ou indisponible : rien à configurer ici

  async function save() {
    setBusy(true); setMessage(null)
    try {
      const res = await fetch('/api/catalogue-suggestions/sectors', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sectors: selected }) })
      if (!res.ok) throw new Error('save')
      setMessage({ kind: 'ok', text: c.saved })
    } catch { setMessage({ kind: 'error', text: c.error }) }
    finally { setBusy(false) }
  }

  const full = selected.length >= MAX_SECTORS
  return (
    <section className="card p-5 mb-6" aria-labelledby="sector-settings-title">
      <h2 id="sector-settings-title" className="text-base font-semibold text-gray-800 dark:text-gray-100">{c.title}</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{c.desc}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {available.map(code => {
          const rank = selected.indexOf(code)
          return (
            <div key={code} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
              <label className="flex min-w-0 items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                <input type="checkbox" checked={rank >= 0} disabled={rank < 0 && full} onChange={() => { setSelected(toggleSector(selected, code)); setMessage(null) }} aria-label={names[code] ?? code} />
                <span className="truncate">{names[code] ?? code}</span>
                {rank === 0 && <span className="rounded-full bg-ebios-100 px-2 py-0.5 text-xs font-semibold text-ebios-800 dark:bg-ebios-900/40 dark:text-ebios-200">{c.principal}</span>}
              </label>
              {rank >= 0 && selected.length > 1 && (
                <span className="flex shrink-0 gap-1">
                  <button type="button" className="btn-secondary px-2 py-0.5 text-xs" disabled={rank === 0} aria-label={c.moveUp.replace('{name}', names[code] ?? code)} onClick={() => setSelected(moveSector(selected, code, 'up'))}>↑</button>
                  <button type="button" className="btn-secondary px-2 py-0.5 text-xs" disabled={rank === selected.length - 1} aria-label={c.moveDown.replace('{name}', names[code] ?? code)} onClick={() => setSelected(moveSector(selected, code, 'down'))}>↓</button>
                </span>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{full ? c.maxReached.replace('{n}', String(MAX_SECTORS)) : c.hint}</p>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void save()}>{c.save}</button>
        {message && <p role={message.kind === 'ok' ? 'status' : 'alert'} className={`text-sm ${message.kind === 'ok' ? 'text-green-800 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>{message.text}</p>}
      </div>
    </section>
  )
}
