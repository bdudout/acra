'use client'

// ─── Import de risques cyber dans une analyse projet 360 ─────────────────────
// Liste les analyses cyber de l'organisation (EBIOS RM, ISO/IEC 27005, NIST SP
// 800-30) et leurs risques ; les risques déjà importés sont signalés et non
// sélectionnables. POST /api/analyses/[id]/import-cyber (copie tracée, domaine CYBER).

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

interface SourceRisk { id: string; nom: string; niveauRisque: number; alreadyImported: boolean }
interface Source { id: string; nom: string; methode: string; risques: SourceRisk[] }

export default function ImportCyberRisks({ analyseId, onImported }: { analyseId: string; onImported?: () => void }) {
  const { t } = useTranslation()
  const p = t.projet360
  const [sources, setSources] = useState<Source[] | null>(null)
  const [sourceId, setSourceId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    const d = await fetch(`/api/analyses/${analyseId}/import-cyber`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null)
    setSources(Array.isArray(d?.sources) ? d.sources : [])
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const source = sources?.find(s => s.id === sourceId)
  const importable = source?.risques.filter(r => !r.alreadyImported) ?? []

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  async function importer() {
    if (!source || selected.size === 0) return
    setBusy(true); setMsg(null)
    const res = await fetch(`/api/analyses/${analyseId}/import-cyber`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceAnalyseId: source.id, risqueIds: [...selected] }),
    }).catch(() => null)
    setBusy(false)
    if (!res || !res.ok) { setMsg(p.importError); return }
    const d = await res.json().catch(() => ({}))
    setMsg(p.imported.replace('{n}', String(d.imported ?? 0)))
    setSelected(new Set())
    await load()
    onImported?.()
  }

  return (
    <section className="card p-6 mt-5">
      <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{p.importTitle}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">{p.importIntro}</p>
      {sources === null ? <p className="text-xs text-gray-400">…</p> : sources.length === 0 ? <p className="text-sm text-gray-500 italic">{p.importNone}</p> : (
        <>
          <label className="text-xs text-gray-600 dark:text-gray-300">{p.importSource}
            <select aria-label={p.importSource} value={sourceId} onChange={e => { setSourceId(e.target.value); setSelected(new Set()); setMsg(null) }}
              className="mt-1 block w-full max-w-md rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600">
              <option value="">{p.importChoose}</option>
              {sources.map(s => <option key={s.id} value={s.id}>{s.nom} ({s.risques.length})</option>)}
            </select>
          </label>
          {source && (
            <div className="mt-3">
              {importable.length > 0 && (
                <button type="button" onClick={() => setSelected(new Set(importable.map(r => r.id)))} className="text-xs text-ebios-700 hover:underline">{p.importSelectAll}</button>
              )}
              <ul className="mt-2 max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                {source.risques.map(r => (
                  <li key={r.id} className="py-1.5">
                    <label className={`flex items-center gap-2 ${r.alreadyImported ? 'text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>
                      <input type="checkbox" disabled={r.alreadyImported} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                      <span className="flex-1">{r.nom}</span>
                      <span className="tabular-nums text-xs">{r.niveauRisque}</span>
                      {r.alreadyImported && <span className="text-[11px] italic">{p.alreadyImported}</span>}
                    </label>
                  </li>
                ))}
              </ul>
              <button type="button" disabled={busy || selected.size === 0} onClick={importer} className="btn-primary text-sm mt-3 disabled:opacity-50">{p.importButton}</button>
            </div>
          )}
        </>
      )}
      {msg && <p role="status" className="mt-2 text-xs text-gray-600 dark:text-gray-300">{msg}</p>}
    </section>
  )
}
