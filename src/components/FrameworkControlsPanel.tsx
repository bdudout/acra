'use client'

import { useState, useMemo } from 'react'
import {
  getFrameworkControles, getFrameworkCategories, FRAMEWORK_META,
  type FrameworkControl, type FrameworkId,
} from '@/lib/frameworks-data'
import { useTranslation } from '@/lib/i18n/context'

interface Props {
  frameworkId: string
  customControles?: FrameworkControl[]
  onSelect: (control: FrameworkControl) => void
  actionLabel?: string
}

export default function FrameworkControlsPanel({
  frameworkId,
  customControles,
  onSelect,
  actionLabel,
}: Props) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({})
  // Track which control refs have already been clicked (added) in this session
  const [addedRefs, setAddedRefs] = useState<Set<string>>(new Set())

  const controls = useMemo(
    () => getFrameworkControles(frameworkId, customControles),
    [frameworkId, customControles]
  )
  const categories = useMemo(() => getFrameworkCategories(frameworkId), [frameworkId])
  const meta = FRAMEWORK_META[frameworkId as FrameworkId]

  const filtered = useMemo(() => {
    if (!search.trim()) return controls
    const q = search.toLowerCase()
    return controls.filter(
      c =>
        c.ref.toLowerCase().includes(q) ||
        c.nom.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    )
  }, [controls, search])

  const grouped = useMemo(() => {
    const map: Record<string, FrameworkControl[]> = {}
    for (const c of filtered) {
      if (!map[c.categorie]) map[c.categorie] = []
      map[c.categorie].push(c)
    }
    return map
  }, [filtered])

  const catKeys = Object.keys(categories)

  function isCatOpen(cat: string): boolean {
    if (cat in openCats) return openCats[cat]
    // Default: open first 2 categories
    return catKeys.indexOf(cat) < 2
  }

  function toggleCat(cat: string) {
    setOpenCats(prev => ({ ...prev, [cat]: !isCatOpen(cat) }))
  }

  if (!meta) return null

  return (
    <div className="border border-indigo-200 rounded-xl bg-indigo-50/40 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-indigo-800">
          {meta.icon} {meta.nom}
          {meta.version && (
            <span className="text-xs font-normal opacity-60 ml-1">{meta.version}</span>
          )}
        </span>
        <span className="text-xs text-indigo-500">
          {controls.length} {controls.length !== 1 ? t.workshop.a5.frameworkCountPl : t.workshop.a5.frameworkCount}
        </span>
      </div>

      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={t.workshop.a5.frameworkSearch}
        className="input text-sm mb-2 w-full"
      />

      {/* Empty state */}
      {controls.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-6 italic">
          {t.workshop.a5.frameworkEmpty}
        </p>
      )}

      {/* Control list */}
      <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
        {Object.entries(grouped).map(([cat, items]) => {
          const catMeta = categories[cat] ?? {
            label: cat,
            icon: '📋',
            color: 'text-gray-700',
            bg: 'bg-gray-50',
          }
          const open = isCatOpen(cat)
          return (
            <div key={cat} className={`rounded-lg border overflow-hidden ${catMeta.bg}`}>
              <button
                type="button"
                onClick={() => toggleCat(cat)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold ${catMeta.color} hover:opacity-80 transition-opacity`}
              >
                <span>
                  {catMeta.icon} {catMeta.label}{' '}
                  <span className="opacity-60">({items.length})</span>
                </span>
                <span aria-hidden="true">{open ? '▲' : '▼'}</span>
              </button>

              {open && (
                <div className="divide-y divide-gray-100">
                  {items.map(c => {
                    const added = addedRefs.has(c.ref)
                    return (
                      <button
                        key={c.ref}
                        type="button"
                        onClick={() => {
                          onSelect(c)
                          setAddedRefs(prev => new Set(prev).add(c.ref))
                        }}
                        className={`w-full text-left px-3 py-2 transition-colors group ${
                          added ? 'bg-green-50' : 'bg-white hover:bg-indigo-50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className={`text-xs font-mono font-semibold flex-shrink-0 mt-0.5 min-w-[4rem] ${
                            added ? 'text-green-700' : 'text-indigo-700'
                          }`}>
                            {c.ref}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs font-medium ${
                              added ? 'text-green-700' : 'text-gray-800 group-hover:text-indigo-700'
                            }`}>
                              {c.nom}
                            </div>
                            <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                              {c.description}
                            </div>
                          </div>
                          {added
                            ? <span className="text-xs text-green-600 font-semibold flex-shrink-0 ml-1">{t.workshop.addedLabel}</span>
                            : <span className="text-xs text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1">
                                + {actionLabel ?? t.workshop.addExample}
                              </span>
                          }
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && search && (
          <p className="text-xs text-gray-500 text-center py-4 italic">
            {t.workshop.a5.frameworkNoResult} — « {search} »
          </p>
        )}
      </div>
    </div>
  )
}
