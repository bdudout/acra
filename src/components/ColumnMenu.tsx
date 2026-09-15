'use client'

// En-tête de colonne façon tableur, RÉUTILISABLE (actions, risques, incidents,
// tiers…). Clic sur le libellé = cycle de tri (asc→desc→aucun) ; l'icône ▾ ouvre
// un menu : tri explicite A→Z / Z→A + filtre auto (cases des valeurs distinctes,
// recherche, Tout/Aucun, Uniquement). Logique pure : lib/table-sort + table-filter.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { sortIndicator, type SortState, type SortDir } from '@/lib/table-sort'

export default function ColumnMenu({
  label, sortKey, sort, onSortDir, onSortClear, onSortCycle,
  values, allowed, onToggle, onOnly, onClearFilter,
  className = '', align = 'left',
}: {
  label: string
  sortKey: string
  sort: SortState | null
  onSortDir: (key: string, dir: SortDir) => void
  onSortClear: () => void
  onSortCycle: (key: string) => void
  /** Valeurs distinctes de la colonne (filtre auto). Absent = colonne non filtrable. */
  values?: string[]
  /** Ensemble autorisé courant (undefined = tout). */
  allowed?: Set<string>
  onToggle?: (key: string, value: string) => void
  onOnly?: (key: string, value: string) => void
  onClearFilter?: (key: string) => void
  className?: string
  align?: 'left' | 'right' | 'center'
}) {
  const { t } = useTranslation()
  const tt = t.table
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLTableCellElement>(null)
  const filterable = Array.isArray(values) && values.length > 0
  const isFiltered = filterable && allowed != null
  const active = sort?.key === sortKey
  const ind = sortIndicator(sort, sortKey)
  const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const isAllowed = (v: string) => allowed == null || allowed.has(v)
  const shown = filterable ? values!.filter(v => !q.trim() || v.toLowerCase().includes(q.trim().toLowerCase())) : []

  return (
    <th ref={ref} className={`px-3 py-2 font-medium relative ${className}`} aria-sort={!active ? 'none' : sort!.dir === 'asc' ? 'ascending' : 'descending'}>
      <div className={`inline-flex items-center gap-1 ${justify}`}>
        <button type="button" onClick={() => onSortCycle(sortKey)}
          className={`group inline-flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-100 ${active ? 'text-gray-800 dark:text-gray-100' : ''}`}>
          <span>{label}</span>
          <span className={`text-[9px] leading-none ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>{ind || '▲'}</span>
        </button>
        <button type="button" aria-label={tt.menu} title={tt.menu} onClick={() => setOpen(o => !o)}
          className={`rounded px-0.5 text-[10px] leading-none ${isFiltered ? 'text-ebios-600 dark:text-ebios-300' : 'text-gray-300 hover:text-gray-600 dark:hover:text-gray-200'}`}>
          {isFiltered ? '▼●' : '▾'}
        </button>
      </div>

      {open && (
        <div className="absolute z-20 left-0 top-full mt-1 w-56 rounded-md border border-gray-200 bg-white shadow-lg text-xs font-normal normal-case tracking-normal text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
          <div className="p-1 border-b border-gray-100 dark:border-gray-700">
            <button type="button" onClick={() => { onSortDir(sortKey, 'asc'); setOpen(false) }} className="block w-full text-left px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700">{tt.sortAsc}</button>
            <button type="button" onClick={() => { onSortDir(sortKey, 'desc'); setOpen(false) }} className="block w-full text-left px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700">{tt.sortDesc}</button>
            {active && <button type="button" onClick={() => { onSortClear(); setOpen(false) }} className="block w-full text-left px-2 py-1 rounded text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">{tt.sortNone}</button>}
          </div>
          {filterable && (
            <div className="p-1">
              <div className="flex items-center gap-1 px-1 pb-1">
                <input value={q} onChange={e => setQ(e.target.value)} placeholder={tt.search}
                  className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 text-xs bg-white dark:bg-gray-900" />
              </div>
              <div className="flex items-center justify-between px-1 pb-1 text-[11px] text-ebios-600 dark:text-ebios-300">
                <button type="button" onClick={() => onClearFilter?.(sortKey)} className="hover:underline">{tt.selectAll}</button>
                <button type="button" onClick={() => { for (const v of values!) if (isAllowed(v)) onToggle?.(sortKey, v) }} className="hover:underline">{tt.selectNone}</button>
                {isFiltered && <button type="button" onClick={() => onClearFilter?.(sortKey)} className="text-gray-400 hover:underline">{tt.clear}</button>}
              </div>
              <ul className="max-h-44 overflow-auto">
                {shown.map(v => (
                  <li key={v} className="group flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input type="checkbox" checked={isAllowed(v)} onChange={() => onToggle?.(sortKey, v)} className="accent-ebios-600" />
                    <span className="flex-1 truncate">{v}</span>
                    <button type="button" onClick={() => onOnly?.(sortKey, v)} className="opacity-0 group-hover:opacity-100 text-[10px] text-ebios-600 dark:text-ebios-300 hover:underline">{tt.onlyThis}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </th>
  )
}
