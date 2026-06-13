'use client'

import { useState } from 'react'
import Link from 'next/link'

// Couleur badge selon score de risque
function niveauColor(score: number) {
  if (score >= 12) return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', label: 'Critique' }
  if (score >= 8)  return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', label: 'Élevé' }
  if (score >= 4)  return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', label: 'Modéré' }
  return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', label: 'Faible' }
}

const STRATEGIES_LABELS: Record<string, string> = {
  REDUIRE:    '🔽 Réduire',
  ACCEPTER:   '✅ Accepter',
  TRANSFERER: '↗️ Transférer',
  REFUSER:    '🚫 Refuser',
  SURVEILLER: '👁️ Surveiller',
}

export interface RisqueRow {
  analyseId:    string
  analyseNom:   string
  analyseOrg:   string | null
  risqueId:     string
  nom:          string
  description:  string | null
  gravite:      number
  vraisemblance:number
  niveauRisque: number
  strategie:    string
  niveauResiduel: number | null
  mesuresCount: number
}

interface Props {
  risques:    RisqueRow[]
  total:      number
  colAnalyse: string
  colRisque:  string
  colScore:   string
  colStrategie: string
  colResiduel:  string
  colMesures:   string
  goToAtelier:  string
  noRisks:      string
  searchPh:      string
  countShown:    string
  countShownFor: string
}

export default function RisquesClient({
  risques, total,
  colAnalyse, colRisque, colScore, colStrategie, colResiduel, colMesures,
  goToAtelier, noRisks, searchPh, countShown, countShownFor,
}: Props) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? risques.filter(r =>
        r.nom.toLowerCase().includes(search.toLowerCase()) ||
        r.analyseNom.toLowerCase().includes(search.toLowerCase())
      )
    : risques

  return (
    <>
      {/* Barre de recherche */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">🔍</span>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={searchPh}
            className="input pl-9 py-2"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              aria-label="Effacer la recherche"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">{search ? '🔍' : '✅'}</div>
          <p className="text-gray-500">
            {search ? `Aucun risque correspondant à « ${search} »` : noRisks}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{colAnalyse}</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{colRisque}</th>
                <th scope="col" className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{colScore}</th>
                <th scope="col" className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">{colStrategie}</th>
                <th scope="col" className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">{colResiduel}</th>
                <th scope="col" className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">{colMesures}</th>
                <th scope="col" className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => {
                const c = niveauColor(r.niveauRisque)
                const cRes = r.niveauResiduel !== null ? niveauColor(r.niveauResiduel) : null
                return (
                  <tr key={r.risqueId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 text-xs">{r.analyseNom}</div>
                      {r.analyseOrg && <div className="text-gray-500 text-xs">{r.analyseOrg}</div>}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="font-medium text-gray-800">{r.nom}</div>
                      {r.description && (
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${c.bg} ${c.text} ${c.border}`}>
                        {r.niveauRisque}/16
                      </span>
                      <div className="text-xs text-gray-500 mt-0.5">{c.label}</div>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className="text-xs text-gray-600">{STRATEGIES_LABELS[r.strategie] ?? r.strategie}</span>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      {cRes ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${cRes.bg} ${cRes.text} ${cRes.border}`}>
                          {r.niveauResiduel}/16
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <span className="text-xs text-gray-600 font-medium">{r.mesuresCount}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/analyses/${r.analyseId}/atelier/5`}
                        className="text-xs text-ebios-600 hover:text-ebios-800 font-medium hover:underline whitespace-nowrap"
                      >
                        {goToAtelier}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
            {countShown
              .replace('{shown}', String(filtered.length))
              .replace('{ctx}', search ? countShownFor.replace('{q}', search) : '')
              .replace('{total}', String(total))}
          </div>
        </div>
      )}
    </>
  )
}
