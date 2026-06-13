'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FolderKanban, AlertTriangle, Shield, CheckCircle2, Loader } from 'lucide-react'

interface SearchResult {
  analyses: { id: string; nom: string; statut: string; organisation: string | null }[]
  risques:  { id: string; nom: string; niveauRisque: number; analyseId: string; analyse: { nom: string } }[]
  actions:  { id: string; nom: string; priorite: number; statut: string; analyseId: string; analyse: { nom: string } }[]
}

function niveauLabel(n: number) {
  if (n >= 12) return { label: 'Critique', cls: 'bg-red-100 text-red-700' }
  if (n >= 8)  return { label: 'Élevé',    cls: 'bg-orange-100 text-orange-700' }
  if (n >= 4)  return { label: 'Modéré',   cls: 'bg-yellow-100 text-yellow-700' }
  return              { label: 'Faible',   cls: 'bg-green-100 text-green-700' }
}

function prioriteLabel(p: number) {
  if (p === 1) return { label: 'P1', cls: 'bg-red-100 text-red-700' }
  if (p === 2) return { label: 'P2', cls: 'bg-orange-100 text-orange-700' }
  return              { label: 'P3', cls: 'bg-yellow-100 text-yellow-700' }
}

export default function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor]   = useState(-1)

  const [focused, setFocused] = useState(false)

  const inputRef    = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fermer sur clic extérieur
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Ouvrir avec Ctrl+K / Cmd+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data: SearchResult = await res.json()
      setResults(data)
      setOpen(true)
      setCursor(-1)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fetchResults(q), 150)
  }

  // Construire la liste plate de tous les résultats navigables
  const flatItems: { href: string; label: string }[] = []
  if (results) {
    results.analyses.forEach(a => flatItems.push({ href: `/analyses/${a.id}`, label: a.nom }))
    results.risques.forEach(r  => flatItems.push({ href: `/analyses/${r.analyseId}/atelier/5`, label: r.nom }))
    results.actions.forEach(m  => flatItems.push({ href: `/actions#${m.id}`, label: m.nom }))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(c => Math.min(c + 1, flatItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(c => Math.max(c - 1, -1))
    } else if (e.key === 'Enter' && cursor >= 0) {
      e.preventDefault()
      router.push(flatItems[cursor].href)
      setOpen(false)
      setQuery('')
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const totalCount = results ? results.analyses.length + results.risques.length + results.actions.length : 0
  let flatIdx = 0

  const expanded = focused || query.length > 0

  return (
    <div className={`relative hidden sm:block transition-all duration-200 ${expanded ? 'w-64' : 'w-32'}`}>
      {/* Input */}
      <div className="relative">
        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { setFocused(true); if (results && totalCount > 0) setOpen(true) }}
          onBlur={() => setFocused(false)}
          placeholder={expanded ? 'Rechercher… (⌘K)' : ''}
          aria-label="Recherche globale"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="global-search-results"
          className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-ebios-300 focus:border-ebios-400
                     transition-all duration-200 placeholder-gray-400"
        />
        {loading && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">…</span>
        )}
        {!expanded && !loading && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs hidden sm:inline">⌘K</span>
        )}
      </div>

      {/* Dropdown */}
      {open && results && (
        <div
          ref={dropdownRef}
          id="global-search-results"
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl
                     shadow-xl z-50 overflow-hidden max-h-96 overflow-y-auto"
        >
          {totalCount === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 italic">Aucun résultat pour « {query} »</div>
          ) : (
            <>
              {/* Analyses */}
              {results.analyses.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100 flex items-center gap-1.5">
                    <FolderKanban size={13} aria-hidden="true" /> Analyses
                  </div>
                  {results.analyses.map(a => {
                    const idx = flatIdx++
                    return (
                      <button
                        key={a.id}
                        role="option"
                        aria-selected={cursor === idx}
                        onClick={() => { router.push(`/analyses/${a.id}`); setOpen(false); setQuery('') }}
                        className={`w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-ebios-50 transition-colors ${cursor === idx ? 'bg-ebios-50' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{a.nom}</div>
                          {a.organisation && <div className="text-xs text-gray-500">{a.organisation}</div>}
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium inline-flex items-center ${
                          a.statut === 'TERMINE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                        }`} aria-label={a.statut === 'TERMINE' ? 'Terminée' : 'En cours'}>
                          {a.statut === 'TERMINE' ? <CheckCircle2 size={13} aria-hidden="true" /> : <Loader size={13} aria-hidden="true" />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Risques */}
              {results.risques.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100 border-t border-t-gray-100 flex items-center gap-1.5">
                    <AlertTriangle size={13} aria-hidden="true" /> Risques
                  </div>
                  {results.risques.map(r => {
                    const idx = flatIdx++
                    const n = niveauLabel(r.niveauRisque)
                    return (
                      <button
                        key={r.id}
                        role="option"
                        aria-selected={cursor === idx}
                        onClick={() => { router.push(`/analyses/${r.analyseId}/atelier/5`); setOpen(false); setQuery('') }}
                        className={`w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-ebios-50 transition-colors ${cursor === idx ? 'bg-ebios-50' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{r.nom}</div>
                          <div className="text-xs text-gray-500 truncate">{r.analyse.nom}</div>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium ${n.cls}`}>
                          {r.niveauRisque}/16
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Actions */}
              {results.actions.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100 border-t border-t-gray-100 flex items-center gap-1.5">
                    <Shield size={13} aria-hidden="true" /> Actions
                  </div>
                  {results.actions.map(m => {
                    const idx = flatIdx++
                    const p = prioriteLabel(m.priorite)
                    return (
                      <button
                        key={m.id}
                        role="option"
                        aria-selected={cursor === idx}
                        onClick={() => { router.push(`/actions`); setOpen(false); setQuery('') }}
                        className={`w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-ebios-50 transition-colors ${cursor === idx ? 'bg-ebios-50' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{m.nom}</div>
                          <div className="text-xs text-gray-500 truncate">{m.analyse.nom}</div>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium ${p.cls}`}>
                          {p.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
