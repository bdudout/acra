'use client'

// ─── Traitements types du registre RGPD : sélection ligne par ligne ──────────
// Aperçu sans écriture (GET /api/ropa/catalogue), puis import des seules lignes cochées.
// Un traitement déjà importé n'est pas sélectionnable ; un nom déjà présent est signalé
// (jamais fusionné) et décoché par défaut.

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

type Item = {
  key: string; nom: string; finalite: string; baseLegale: string; dureeConservation: string
  categoriesPersonnes: string[]; status: 'NEW' | 'ALREADY_IMPORTED' | 'SIMILAR'
}

export default function RopaCataloguePanel({ onImported }: { onImported: () => void }) {
  const { t, locale } = useTranslation()
  const r = t.ropa
  const c = r.catalogue
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Item[] | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<number | null>(null)

  async function load() {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ropa/catalogue?locale=${locale}`)
      if (!res.ok) throw new Error('load')
      const data = await res.json() as { items: Item[] }
      setItems(data.items)
      setSelected(data.items.filter(i => i.status === 'NEW').map(i => i.key))
    } catch { setError(r.err_generic) } finally { setBusy(false) }
  }

  async function submit() {
    if (!selected.length) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/ropa/catalogue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keys: selected, locale }) })
      if (!res.ok) throw new Error('import')
      const data = await res.json() as { created: string[] }
      setReport(data.created.length)
      onImported()
      await load()
    } catch { setError(r.err_generic) } finally { setBusy(false) }
  }

  const toggle = (key: string) => setSelected(keys => keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key])

  return <div className="mb-5">
    <button type="button" className="btn-secondary text-sm" onClick={() => { setOpen(true); setReport(null); void load() }}>{c.open}</button>
    {open && <section role="dialog" aria-label={c.title} className="card mt-3 p-4 space-y-3 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="font-semibold text-gray-900 dark:text-gray-100">{c.title}</h2><p className="text-sm text-gray-600 dark:text-gray-300">{c.hint}</p></div>
        <button type="button" className="btn-secondary text-sm" onClick={() => setOpen(false)}>{c.close}</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {report !== null && <p role="status" className="text-sm text-green-800 dark:text-green-300">{c.report.replace('{n}', String(report))}</p>}
      <div className="max-h-96 overflow-y-auto space-y-1">
        {(items ?? []).map(item => (
          <label key={item.key} data-key={item.key} className="flex gap-2 rounded px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
            <input type="checkbox" className="mt-1" checked={selected.includes(item.key)} disabled={item.status === 'ALREADY_IMPORTED'} onChange={() => toggle(item.key)} aria-label={item.nom} />
            <span className="min-w-0 text-sm">
              <span className="font-medium text-gray-900 dark:text-gray-100">{item.nom}</span>
              {item.status !== 'NEW' && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({c.status[item.status]})</span>}
              <span className="block text-xs text-gray-600 dark:text-gray-300">{item.finalite}</span>
              {item.baseLegale && <span className="block text-xs text-gray-500 dark:text-gray-400">{r.fBase} : {(r.bases as Record<string, string>)[item.baseLegale] ?? item.baseLegale}</span>}
              {item.dureeConservation && <span className="block text-xs text-gray-500 dark:text-gray-400">{r.fDuree} : {item.dureeConservation}</span>}
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs text-amber-800 dark:text-amber-300">{c.legalNote}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-300">{c.selected.replace('{n}', String(selected.length))}</span>
        <button type="button" className="btn-primary text-sm disabled:opacity-50" disabled={busy || !selected.length} onClick={() => void submit()}>{c.import}</button>
      </div>
    </section>}
  </div>
}
