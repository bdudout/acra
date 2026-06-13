'use client'

import { useState, useMemo } from 'react'
import { ISO27001_ANNEXE_A, ISO27001_CATEGORIES, type ISO27001Controle } from '@/lib/ebios-data'
import { useTranslation } from '@/lib/i18n/context'

interface Props {
  /** Appelé quand l'utilisateur clique sur un contrôle pour l'ajouter */
  onSelect: (controle: ISO27001Controle) => void
  /** Libellé du bouton d'action (ex: "Ajouter", "Utiliser comme mesure") */
  actionLabel?: string
}

const TYPE_COLORS: Record<string, string> = {
  ORGANISATIONNELLE: 'bg-purple-100 text-purple-700',
  HUMAINE:           'bg-blue-100 text-blue-700',
  PHYSIQUE:          'bg-amber-100 text-amber-700',
  TECHNOLOGIQUE:     'bg-teal-100 text-teal-700',
}

export default function ISO27001Panel({ onSelect, actionLabel = 'Ajouter' }: Props) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({ '5': true, '6': false, '7': false, '8': true })

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return ISO27001_ANNEXE_A
    return ISO27001_ANNEXE_A.filter(c =>
      c.ref.includes(q) ||
      c.nom.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    )
  }, [search])

  const byCategory = useMemo(() => {
    const map: Record<string, ISO27001Controle[]> = { '5': [], '6': [], '7': [], '8': [] }
    for (const c of filtered) map[c.categorie].push(c)
    return map
  }, [filtered])

  const toggleCat = (cat: string) => setOpenCats(prev => ({ ...prev, [cat]: !prev[cat] }))

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-800">ISO/IEC 27001:2022 — Annexe A</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-mono">93 contrôles</span>
          </div>
          <p className="text-xs text-gray-500">Cliquez sur un contrôle pour l'ajouter. Les références sont celles de l'Annexe A normative.</p>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-gray-100">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t.ph.isoSearch}
          className="input text-sm py-1.5"
          aria-label="Rechercher dans les contrôles ISO 27001"
        />
        {search && (
          <p className="text-xs text-gray-400 mt-1">
            {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Categories */}
      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {(['5', '6', '7', '8'] as const).map(cat => {
          const controls = byCategory[cat]
          if (controls.length === 0) return null
          const meta = ISO27001_CATEGORIES[cat]
          const isOpen = openCats[cat] ?? false

          return (
            <div key={cat}>
              {/* Category header */}
              <button
                onClick={() => toggleCat(cat)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:brightness-95 transition-all ${meta.bg}`}
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base" aria-hidden="true">{meta.icon}</span>
                  <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/60 text-gray-600 font-mono">
                    {controls.length}/{['5','6','7','8'].indexOf(cat) === 0 ? 37 : ['5','6','7','8'].indexOf(cat) === 1 ? 8 : ['5','6','7','8'].indexOf(cat) === 2 ? 14 : 34}
                  </span>
                </div>
                <span className={`text-xs ${meta.color}`} aria-hidden="true">
                  {isOpen ? '▲' : '▼'}
                </span>
              </button>

              {/* Controls grid */}
              {isOpen && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2 bg-white">
                  {controls.map(c => (
                    <button
                      key={c.ref}
                      onClick={() => onSelect(c)}
                      className="group text-left p-2.5 border border-dashed border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors"
                      title={c.description}
                    >
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-xs font-bold font-mono text-gray-500 min-w-[2.5rem]">{c.ref}</span>
                        <span className={`text-xs px-1 py-0.5 rounded font-medium ${TYPE_COLORS[c.type]}`}>
                          {c.type === 'ORGANISATIONNELLE' ? 'Org.' :
                           c.type === 'HUMAINE' ? 'RH' :
                           c.type === 'PHYSIQUE' ? 'Phys.' : 'Tech.'}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-gray-700 leading-snug group-hover:text-gray-900">
                        {c.nom}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 leading-snug line-clamp-2 hidden sm:block">
                        {c.description}
                      </div>
                      <div className="mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-ebios-600 font-medium">+ {actionLabel}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">
            Aucun contrôle ne correspond à votre recherche.
          </div>
        )}
      </div>
    </div>
  )
}
