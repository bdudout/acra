'use client'

// ─── Sélecteur d'incident type (cyber et autres risques) : liste cherchable, simple à cliquer ──────────────────────────────
// Préremplit la déclaration (intitulé, type d'événement, liste « à compléter », données personnelles possibles) sans jamais
// inventer un fait ; tout reste modifiable. Un incident hors catalogue se saisit librement.

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { INCIDENT_TYPES, incidentTemplate, searchIncidentTypes, type IncidentLocale, type IncidentTemplate } from '@/lib/incident-types-catalogue'

const BADGE: Record<string, string> = {
  CYBER: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200', FRAUDE: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200',
  PROCESSUS: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200', CONTINUITE: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200',
  SECURITE_PHYSIQUE: 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100', DONNEES_PERSONNELLES: 'bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200', AUTRE: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
}

export default function IncidentTypePicker({ selectedKey, onPick, onClear, sectors: sectorsProp }: { selectedKey?: string | null; onPick: (tpl: IncidentTemplate) => void; onClear?: () => void; sectors?: string[] }) {
  const { t, locale } = useTranslation()
  const c = t.incidents.catalogueTypes
  const loc = (['fr', 'en', 'de', 'es', 'it'].includes(locale) ? locale : 'fr') as IncidentLocale
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<'ALL' | 'CYBER' | 'OTHER'>('ALL')
  // Secteurs de l'organisation (prop, sinon lus à l'ouverture) : le socle générique + ces secteurs ; « Tous les secteurs » lève le filtre.
  const [sectors, setSectors] = useState<string[]>(sectorsProp ?? [])
  const [allSectors, setAllSectors] = useState(false)
  useEffect(() => {
    if (!open || sectorsProp !== undefined || typeof fetch !== 'function') return
    let off = false
    Promise.resolve(fetch('/api/catalogue-suggestions/active-sectors')).then(r => (r?.ok ? r.json() : null)).then(j => { if (!off && Array.isArray(j?.effective)) setSectors(j.effective) }).catch(() => {})
    return () => { off = true }
  }, [open, sectorsProp])
  const selected = INCIDENT_TYPES.find(x => x.key === selectedKey)
  const list = useMemo(() => searchIncidentTypes(q, loc, allSectors ? undefined : sectors).filter(x => cat === 'ALL' || (cat === 'CYBER' ? x.categorie === 'CYBER' : x.categorie !== 'CYBER')), [q, loc, cat, sectors, allSectors])
  const cats = c.categories as Record<string, string>

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary text-sm">{selected ? c.change : c.choose}</button>
        {selected && (
          <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs text-gray-700 dark:text-gray-200">
            <span className={`rounded-full px-1.5 py-px text-[10px] font-medium ${BADGE[selected.categorie]}`}>{cats[selected.categorie]}</span>{selected.title[loc]}
            {onClear && <button type="button" aria-label={c.clear} onClick={onClear} className="text-gray-400 hover:text-gray-700">×</button>}
          </span>
        )}
        <span className="text-[11px] text-gray-400">{c.hint}</span>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2" role="group" aria-label={c.title}>
      <div className="flex flex-wrap items-center gap-2">
        <input autoFocus aria-label={c.search} placeholder={c.search} value={q} onChange={e => setQ(e.target.value)} className="flex-1 min-w-[12rem] px-2.5 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
        {(['ALL', 'CYBER', 'OTHER'] as const).map(k => (
          <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)} className={`text-xs rounded-full px-2.5 py-1 border ${cat === k ? 'bg-ebios-600 text-white border-ebios-600' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'}`}>{c.filters[k]}</button>
        ))}
        {sectors.length > 0 && <button type="button" aria-pressed={allSectors} onClick={() => setAllSectors(v => !v)} className="text-xs rounded-full px-2.5 py-1 border border-gray-300 dark:border-gray-600">{allSectors ? c.mySectors : c.allSectors}</button>}
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 underline">{c.close}</button>
      </div>
      {list.length === 0 && <p className="text-xs italic text-gray-500">{c.noResult}</p>}
      <ul role="listbox" aria-label={c.title} className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
        {list.map(x => (
          <li key={x.key} role="option" aria-selected={x.key === selectedKey}>
            <button type="button" onClick={() => { const tpl = incidentTemplate(x.key, loc); if (tpl) onPick(tpl); setOpen(false) }} className="w-full text-left px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-start gap-2">
              <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium ${BADGE[x.categorie]}`}>{cats[x.categorie]}</span>
              <span className="text-sm text-gray-800 dark:text-gray-100">{x.title[loc]}</span>
              {x.sector && <span className="ml-auto shrink-0 text-[10px] text-gray-500">{(t.sectorSuggestions.sectors as Record<string, string>)[x.sector] ?? x.sector}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
