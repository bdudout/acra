'use client'

// ─── Catalogue des contrôles-types : trois portes d'entrée au choix du contrôleur ─
// Par référentiel (socles reliés aux exigences), par processus ou par risque (catalogue sectoriel).
// Un même modèle a la même clé quelle que soit l'entrée : il n'est jamais importé deux fois.
// Aperçu sans écriture, sélection ligne par ligne, import explicite (POST /api/controles/catalogue).

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

type Template = {
  key: string; origin: 'REFERENTIEL' | 'CATALOGUE'; title: string; description?: string; periodicite: string
  referentiel?: { id: string; nom: string }; processKey?: string; riskKeys: string[]
  contentLocale: string; status: 'NEW' | 'ALREADY_IMPORTED' | 'SIMILAR'
}
type Catalogue = {
  templates: Template[]; referentiels: { id: string; nom: string; count: number }[]
  processes: { key: string; title: string }[]; risks: { key: string; title: string }[]
  ownedProcessKeys: string[]; ownedRiskKeys: string[]
}
type Angle = 'REFERENTIEL' | 'PROCESSUS' | 'RISQUE'

export default function ControleCataloguePanel({ onImported }: { onImported: () => void }) {
  const { t, locale } = useTranslation()
  const c = t.controleCatalogue
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<Catalogue | null>(null)
  const [angle, setAngle] = useState<Angle>('REFERENTIEL')
  const [referentiel, setReferentiel] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<number | null>(null)

  async function load() {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/controles/catalogue?locale=${locale}`)
      if (!res.ok) throw new Error('load')
      const d = await res.json() as Catalogue
      setData(d); setReferentiel(current => current || d.referentiels[0]?.id || '')
    } catch { setError(c.error) } finally { setBusy(false) }
  }

  async function submit() {
    if (!selected.length) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/controles/catalogue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keys: selected, locale }) })
      if (!res.ok) throw new Error('import')
      const d = await res.json() as { created: string[] }
      setReport(d.created.length); setSelected([])
      onImported(); await load()
    } catch { setError(c.error) } finally { setBusy(false) }
  }

  const toggle = (key: string) => setSelected(keys => keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key])
  const catalogueTemplates = (data?.templates ?? []).filter(x => x.origin === 'CATALOGUE')
  const titleOf = new Map([...(data?.processes ?? []), ...(data?.risks ?? [])].map(x => [x.key, x.title]))

  // Groupes affichés selon la porte d'entrée choisie.
  const groups: { key: string; title: string; owned: boolean; items: Template[] }[] =
    angle === 'REFERENTIEL'
      ? [{ key: referentiel, title: data?.referentiels.find(r => r.id === referentiel)?.nom ?? '', owned: true, items: (data?.templates ?? []).filter(x => x.referentiel?.id === referentiel) }]
      : angle === 'PROCESSUS'
        ? (data?.processes ?? []).map(p => ({ key: p.key, title: p.title, owned: !!data?.ownedProcessKeys.includes(p.key), items: catalogueTemplates.filter(x => x.processKey === p.key) })).filter(g => g.items.length)
        : (data?.risks ?? []).map(r => ({ key: r.key, title: r.title, owned: !!data?.ownedRiskKeys.includes(r.key), items: catalogueTemplates.filter(x => x.riskKeys.includes(r.key)) })).filter(g => g.items.length)

  const row = (x: Template) => (
    <label key={x.key} data-key={x.key} className="flex gap-2 rounded-sm px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800">
      <input type="checkbox" className="mt-1" checked={selected.includes(x.key)} disabled={x.status === 'ALREADY_IMPORTED'} onChange={() => toggle(x.key)} aria-label={x.title} />
      <span className="min-w-0 text-sm">
        <span className="text-gray-900 dark:text-gray-100">{x.title}</span>
        {x.status !== 'NEW' && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({c.status[x.status]})</span>}
        {x.description && <span className="block text-xs text-gray-600 dark:text-gray-300">{x.description}</span>}
        {angle !== 'PROCESSUS' && x.processKey && <span className="block text-xs text-gray-500 dark:text-gray-400">↳ {titleOf.get(x.processKey)}</span>}
      </span>
    </label>
  )

  return <div>
    <button type="button" className="btn-secondary text-sm" onClick={() => { setOpen(o => !o); setReport(null); if (!data) void load() }}>{c.open}</button>
    {open && <section role="dialog" aria-label={c.title} className="card mt-3 mb-5 p-4 space-y-3 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="font-semibold text-gray-900 dark:text-gray-100">{c.title}</h2><p className="text-sm text-gray-600 dark:text-gray-300">{c.hint}</p></div>
        <button type="button" className="btn-secondary text-sm" onClick={() => setOpen(false)}>{c.close}</button>
      </div>
      <div role="tablist" aria-label={c.angleLabel} className="flex flex-wrap gap-2">
        {(['REFERENTIEL', 'PROCESSUS', 'RISQUE'] as Angle[]).map(a => (
          <button key={a} type="button" role="tab" aria-selected={angle === a} onClick={() => setAngle(a)}
            className={`rounded-full px-3 py-1 text-sm border ${angle === a ? 'bg-ebios-600 text-white border-ebios-600' : 'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200'}`}>{c.angles[a]}</button>
        ))}
      </div>
      {angle === 'REFERENTIEL' && <label className="block text-sm text-gray-700 dark:text-gray-200">{c.referentiel}
        <select className="mt-1 w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" value={referentiel} onChange={e => setReferentiel(e.target.value)}>
          {(data?.referentiels ?? []).map(r => <option key={r.id} value={r.id}>{r.nom} ({r.count})</option>)}
        </select>
        {locale !== 'fr' && <span className="mt-1 block text-xs text-amber-800 dark:text-amber-300">{c.frenchOnly}</span>}
      </label>}
      {angle !== 'REFERENTIEL' && <p className="text-xs text-gray-500 dark:text-gray-400">{angle === 'PROCESSUS' ? c.processHint : c.riskHint}</p>}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {report !== null && <p role="status" className="text-sm text-green-800 dark:text-green-300">{c.report.replace('{n}', String(report))}</p>}
      <div className="max-h-96 overflow-y-auto space-y-3">
        {groups.map(g => <div key={g.key}>
          {angle !== 'REFERENTIEL' && <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{g.title}{!g.owned && <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">({angle === 'PROCESSUS' ? c.processMissing : c.riskMissing})</span>}</p>}
          <div className="space-y-0.5">{g.items.map(row)}</div>
        </div>)}
        {!busy && data && groups.every(g => !g.items.length) && <p className="text-sm text-gray-600 dark:text-gray-300">{c.empty}</p>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-300">{c.selected.replace('{n}', String(selected.length))}</span>
        <button type="button" className="btn-primary text-sm disabled:opacity-50" disabled={busy || !selected.length} onClick={() => void submit()}>{c.import}</button>
      </div>
    </section>}
  </div>
}
