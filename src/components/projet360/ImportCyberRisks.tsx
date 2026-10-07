'use client'

// ─── Import de risques cyber et de tiers dans une analyse projet 360 ─────────
// Recherche d'une analyse cyber de l'organisation (EBIOS RM, ISO/IEC 27005, NIST SP 800-30) par son nom — liste
// légère, on ne charge jamais tous les risques de toutes les analyses — puis risques de l'analyse choisie ; les risques
// déjà importés sont signalés et non sélectionnables. Les tiers de l'analyse suivent (case cochée par défaut) ; on peut
// importer les tiers seuls. POST /api/analyses/[id]/import-cyber (copie tracée, domaine CYBER).

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

interface SourceRisk { id: string; nom: string; niveauRisque: number; alreadyImported: boolean }
interface SourceRow { id: string; nom: string; methode: string; nbRisques: number; nbTiers: number }
interface SourceDetail { id: string; nom: string; nbTiers: number; risques: SourceRisk[] }

const field = 'mt-1 block w-full max-w-md rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600'

export default function ImportCyberRisks({ analyseId, onImported, onVoirRisques }: { analyseId: string; onImported?: () => void; onVoirRisques?: () => void }) {
  const { t } = useTranslation()
  const p = t.projet360
  const [q, setQ] = useState('')
  const [sources, setSources] = useState<SourceRow[] | null>(null)
  const [sourceId, setSourceId] = useState('')
  const [source, setSource] = useState<SourceDetail | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [avecTiers, setAvecTiers] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Recherche (légèrement différée pendant la frappe).
  useEffect(() => {
    const h = setTimeout(() => {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
      fetch(`/api/analyses/${analyseId}/import-cyber${qs}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null)).then(d => setSources(Array.isArray(d?.sources) ? d.sources : [])).catch(() => setSources([]))
    }, q ? 250 : 0)
    return () => clearTimeout(h)
  }, [analyseId, q])

  async function loadSource(id: string) {
    setSource(null)
    if (!id) return
    const d = await fetch(`/api/analyses/${analyseId}/import-cyber?source=${encodeURIComponent(id)}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null)
    setSource(d?.source ?? null)
  }

  const importable = source?.risques.filter(r => !r.alreadyImported) ?? []
  const tiersPossibles = avecTiers && (source?.nbTiers ?? 0) > 0

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  async function importer() {
    if (!source || (selected.size === 0 && !tiersPossibles)) return
    setBusy(true); setMsg(null); setDone(false)
    const res = await fetch(`/api/analyses/${analyseId}/import-cyber`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceAnalyseId: source.id, risqueIds: [...selected], importerTiers: avecTiers }),
    }).catch(() => null)
    setBusy(false)
    if (!res || !res.ok) { setMsg(p.importError); return }
    const d = await res.json().catch(() => ({}))
    setMsg(p.importDone.replace('{n}', String(d.imported ?? 0)).replace('{t}', String(d.tiers ?? 0)))
    setDone(true)
    setSelected(new Set())
    await loadSource(source.id)
    onImported?.()
  }

  return (
    <section className="card p-6 mt-5">
      <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{p.importTitle}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">{p.importIntro}</p>
      <label className="block text-xs text-gray-600 dark:text-gray-300">{p.importSearch}
        <input aria-label={p.importSearch} type="search" value={q} placeholder={p.importSearchPlaceholder} onChange={e => setQ(e.target.value)} className={field} />
      </label>
      {sources === null ? <p className="mt-2 text-xs text-gray-400">…</p> : sources.length === 0 ? <p className="mt-2 text-sm text-gray-500 italic">{q ? p.importNoMatch : p.importNone}</p> : (
        <label className="mt-3 block text-xs text-gray-600 dark:text-gray-300">{p.importSource}
          <select aria-label={p.importSource} value={sourceId} onChange={e => { setSourceId(e.target.value); setSelected(new Set()); setMsg(null); setDone(false); void loadSource(e.target.value) }} className={field}>
            <option value="">{p.importChoose}</option>
            {sources.map(s => <option key={s.id} value={s.id}>{s.nom} — {p.importSourceCounts.replace('{r}', String(s.nbRisques)).replace('{t}', String(s.nbTiers))}</option>)}
          </select>
        </label>
      )}
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
          {source.nbTiers > 0 && (
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input type="checkbox" checked={avecTiers} onChange={e => setAvecTiers(e.target.checked)} />
              {p.importTiers.replace('{n}', String(source.nbTiers))}
            </label>
          )}
          <button type="button" disabled={busy || (selected.size === 0 && !tiersPossibles)} onClick={importer} className="btn-primary text-sm mt-3 disabled:opacity-50">{p.importButton}</button>
        </div>
      )}
      {msg && (
        <p role="status" className="mt-2 text-xs text-gray-600 dark:text-gray-300">
          {msg}
          {done && onVoirRisques && <button type="button" onClick={onVoirRisques} className="ml-2 font-medium text-ebios-700 hover:underline">{p.importVoirRisques}</button>}
        </p>
      )}
    </section>
  )
}
