'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import type { SectorCode } from '@/lib/sector-suggestions'

type Item = { key: string; title: string; kind: 'PROCESS' | 'RISK' | 'CONTROL' | 'KRI' | 'AUDIT'; sector: string; status: 'NEW' | 'ALREADY_IMPORTED'; processKey?: string; parentKey?: string }
type Preview = { sector: SectorCode | null; configuredSectors: SectorCode[]; sectors: SectorCode[]; items: Item[]; version: string }

/** Sélection volontaire, jamais de création automatique à l'ouverture d'un module. */
export default function SectorSuggestionsPanel({ canCreateProcesses, onImported }: { canCreateProcesses: boolean; onImported: () => void }) {
  const { t, locale } = useTranslation()
  const s = t.sectorSuggestions
  const prefs = t.sectorSuggestionPrefs
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [sector, setSector] = useState<SectorCode | null>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [unlinked, setUnlinked] = useState<Array<{ key: string; dependencyKey: string }>>([])
  const [report, setReport] = useState<{ created: number; already: number } | null>(null)
  const [sectorSaved, setSectorSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load(chosen?: SectorCode | null) {
    setBusy(true); setError(null)
    const params = new URLSearchParams({ locale })
    if (chosen !== undefined) params.set('sector', chosen ?? 'TRANSVERSAL')
    try {
      const res = await fetch(`/api/catalogue-suggestions?${params}`)
      if (!res.ok) throw new Error('load')
      const data = await res.json() as Preview
      setPreview(data); setSector(data.sector); setSelected([]); setUnlinked([]); setSectorSaved(false)
    } catch { setError(s.loadError) }
    finally { setBusy(false) }
  }

  async function saveSector() {
    if (!sector || !preview) return
    const sectors = [...new Set([...(preview.configuredSectors ?? []), sector])]
    if (sectors.length > 3) { setError(prefs.maxSectors); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/catalogue-suggestions/sectors', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sectors }),
      })
      if (!res.ok) throw new Error('save')
      setPreview(current => current ? { ...current, configuredSectors: sectors } : current)
      setSectorSaved(true)
    } catch { setError(s.importError) }
    finally { setBusy(false) }
  }

  async function submit(acceptUnlinked = false) {
    if (!selected.length) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/catalogue-suggestions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sector, locale, selectedKeys: selected, acceptUnlinked }),
      })
      const data = await res.json()
      if (res.status === 409 && data.error === 'unlinked_dependencies') {
        setUnlinked(data.unlinked ?? []); return
      }
      if (!res.ok) throw new Error('import')
      setUnlinked([]); setSelected([])
      setReport({ created: data.created?.length ?? 0, already: data.alreadyImported?.length ?? 0 })
      onImported()
      await load(sector)
    } catch { setError(s.importError) }
    finally { setBusy(false) }
  }

  const norm = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const words = norm(query).trim().split(/\s+/).filter(Boolean)
  const visible = preview?.items.filter(item => words.every(word => norm(item.title).includes(word))) ?? []
  // Hiérarchie lisible : processus racines puis leurs enfants (indentés), ensuite les risques (avec le processus concerné).
  const titleOf = new Map((preview?.items ?? []).map(item => [item.key, item.title]))
  const depthOf = (key: string): number => { const parent = preview?.items.find(i => i.key === key)?.parentKey; return parent ? 1 + depthOf(parent) : 0 }
  const processes = visible.filter(item => item.kind === 'PROCESS')
  const shown = new Set(processes.map(item => item.key))
  const ordered: Item[] = []
  const walk = (parent: string | undefined) => processes.filter(item => (item.parentKey && shown.has(item.parentKey) ? item.parentKey : undefined) === parent).forEach(item => { ordered.push(item); walk(item.key) })
  walk(undefined)
  const listed = [...ordered, ...visible.filter(item => item.kind !== 'PROCESS')]
  const toggle = (key: string) => setSelected(keys => keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key])

  return <div className="mb-5">
    <button type="button" className="btn-secondary text-sm" onClick={() => { setOpen(true); setReport(null); void load() }}>{s.title}</button>
    {open && <section role="dialog" aria-label={s.title} className="card mt-3 p-4 space-y-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="font-semibold text-gray-900 dark:text-gray-100">{s.title}</h2><p className="text-sm text-gray-600 dark:text-gray-300">{s.hint}</p></div>
        <button type="button" className="btn-secondary text-sm" onClick={() => setOpen(false)}>{s.close}</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-gray-700 dark:text-gray-200">{s.sector}
          <select className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" value={sector ?? ''} onChange={event => { const next = event.target.value as SectorCode | ''; void load(next || null) }}>
            <option value="">{s.transversal}</option>
            {(preview?.sectors ?? []).map(code => <option key={code} value={code}>{s.sectors[code]}</option>)}
          </select>
        </label>
        <label className="text-sm text-gray-700 dark:text-gray-200">{s.search}
          <input className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
      </div>
      {canCreateProcesses && sector && !preview?.configuredSectors?.includes(sector) && <button type="button" disabled={busy} className="btn-secondary text-sm" onClick={() => void saveSector()}>{prefs.saveSector}</button>}
      {sectorSaved && <p role="status" className="text-sm text-green-800 dark:text-green-300">{prefs.sectorSaved}</p>}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {report && <p role="status" className="text-sm text-green-800 dark:text-green-300">{s.report.replace('{n}', String(report.created))} · {s.already.replace('{n}', String(report.already))}</p>}
      {!busy && visible.length === 0 && <p className="text-sm text-gray-600 dark:text-gray-300">{s.noResults}</p>}
      <div className="max-h-80 overflow-y-auto space-y-1">
        {listed.map(item => {
          const disabled = item.status === 'ALREADY_IMPORTED' || (item.kind === 'PROCESS' && !canCreateProcesses)
          return <label key={item.key} data-testid="suggestion-row" data-key={item.key} data-depth={depthOf(item.key)} style={{ paddingLeft: `${8 + depthOf(item.key) * 20}px` }} className="flex gap-2 rounded py-1.5 pr-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800">
            <input type="checkbox" className="mt-1" checked={selected.includes(item.key)} disabled={disabled} onChange={() => toggle(item.key)} aria-label={item.title} />
            <span className="min-w-0"><span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mr-2">{item.kind === 'PROCESS' ? s.process : item.kind === 'CONTROL' ? s.control : item.kind === 'KRI' ? s.kri : item.kind === 'AUDIT' ? s.audit : s.risk}</span>{item.title}{item.kind !== 'PROCESS' && item.processKey && titleOf.get(item.processKey) && <span className="block text-xs text-gray-500 dark:text-gray-400">↳ {titleOf.get(item.processKey)}</span>}{item.status === 'ALREADY_IMPORTED' && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({s.imported})</span>}</span>
          </label>
        })}
      </div>
      {unlinked.length > 0 && <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
        <p>{s.unlinkedWarning}</p><ul className="mt-1 list-disc pl-5">{unlinked.map(item => <li key={item.key}>{preview?.items.find(i => i.key === item.key)?.title ?? item.key}</li>)}</ul>
        <button type="button" disabled={busy} className="btn-secondary mt-2" onClick={() => void submit(true)}>{s.importUnlinked}</button>
      </div>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-300">{s.selected.replace('{n}', String(selected.length))}</span>
        <button type="button" disabled={busy || !selected.length} className="btn-primary disabled:opacity-50" onClick={() => void submit()}>{s.importSelected}</button>
      </div>
    </section>}
  </div>
}
