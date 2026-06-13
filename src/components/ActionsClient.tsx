'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

// Badge couleur selon statut
function statutColor(statut: string) {
  switch (statut) {
    case 'A_FAIRE':  return 'bg-gray-100 text-gray-700 border-gray-200'
    case 'EN_COURS': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'REALISE':  return 'bg-green-100 text-green-700 border-green-200'
    case 'REPORTE':  return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    default:         return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

// Badge couleur selon priorité
function prioriteColor(p: number) {
  if (p === 1) return 'bg-red-100 text-red-700 border-red-200'
  if (p === 2) return 'bg-orange-100 text-orange-700 border-orange-200'
  if (p === 3) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  return 'bg-gray-100 text-gray-600 border-gray-200'
}

// Badge couleur selon type de mesure
function typeColor(type: string) {
  switch (type) {
    case 'PREVENTIVE':        return 'bg-blue-50 text-blue-600'
    case 'DETECTIVE':         return 'bg-purple-50 text-purple-600'
    case 'CORRECTIVE':        return 'bg-orange-50 text-orange-600'
    case 'DISSUASIVE':        return 'bg-pink-50 text-pink-600'
    case 'ORGANISATIONNELLE': return 'bg-teal-50 text-teal-600'
    case 'TECHNIQUE':         return 'bg-indigo-50 text-indigo-600'
    default:                  return 'bg-gray-50 text-gray-600'
  }
}

export interface MesureRow {
  mesureId:    string
  analyseId:   string
  analyseNom:  string
  analyseOrg:  string | null
  nom:         string
  description: string | null
  type:        string
  priorite:    number
  statut:      string
  responsable: string | null
  entite:      string | null
  echeance:    string | null   // ISO string (sérialisé depuis Date)
  enRetard:    boolean
}

interface Props {
  mesures:      MesureRow[]
  total:        number
  allEntites:   string[]
  statutLabels: Record<string, string>
  typeLabels:   Record<string, string>
  colAnalyse:   string
  colMesure:    string
  colType:      string
  colPriorite:  string
  colStatut:    string
  colResponsable: string
  colEntite:    string
  colEcheance:  string
  goToAtelier:  string
  noActions:    string
  retard:       string
  filterStatutLabel:   string
  filterEntiteLabel:   string
  filterEcheanceLabel: string
  filterAllStatuts:    string
  filterAllEntites:    string
  echeanceRetard:      string
  echeanceSemaine:     string
  echeanceMois:        string
  echeanceSans:        string
  searchPh:            string
  resultCount:         string   // template : '{n} ... {total} ...'
}

export default function ActionsClient({
  mesures, total, allEntites,
  statutLabels, typeLabels,
  colAnalyse, colMesure, colType, colPriorite, colStatut,
  colResponsable, colEntite, colEcheance, goToAtelier, noActions, retard,
  filterStatutLabel, filterEntiteLabel, filterEcheanceLabel,
  filterAllStatuts, filterAllEntites,
  echeanceRetard, echeanceSemaine, echeanceMois, echeanceSans,
  searchPh, resultCount,
}: Props) {
  const [search,          setSearch]          = useState('')
  const [filterStatut,    setFilterStatut]    = useState('')
  const [filterEntite,    setFilterEntite]    = useState('')
  const [filterEcheance,  setFilterEcheance]  = useState('')

  const now = useMemo(() => new Date(), [])

  const filtered = useMemo(() => {
    let list = mesures

    // Filtre texte
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m =>
        m.nom.toLowerCase().includes(q) ||
        m.analyseNom.toLowerCase().includes(q) ||
        (m.responsable ?? '').toLowerCase().includes(q) ||
        (m.entite ?? '').toLowerCase().includes(q)
      )
    }

    // Filtre statut
    if (filterStatut) {
      list = list.filter(m => m.statut === filterStatut)
    }

    // Filtre entité
    if (filterEntite) {
      list = list.filter(m => (m.entite ?? '') === filterEntite)
    }

    // Filtre échéance
    if (filterEcheance === 'retard') {
      list = list.filter(m => m.enRetard)
    } else if (filterEcheance === 'semaine') {
      const end = new Date(now)
      end.setDate(end.getDate() + 7)
      list = list.filter(m => m.echeance && !m.enRetard && new Date(m.echeance) <= end)
    } else if (filterEcheance === 'mois') {
      const end = new Date(now)
      end.setMonth(end.getMonth() + 1)
      list = list.filter(m => m.echeance && !m.enRetard && new Date(m.echeance) <= end)
    } else if (filterEcheance === 'sans') {
      list = list.filter(m => !m.echeance)
    }

    return list
  }, [mesures, search, filterStatut, filterEntite, filterEcheance, now])

  const hasFilters = search.trim() || filterStatut || filterEntite || filterEcheance

  function clearFilters() {
    setSearch('')
    setFilterStatut('')
    setFilterEntite('')
    setFilterEcheance('')
  }

  const selectCls = 'text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-ebios-300 focus:border-ebios-400'

  return (
    <>
      {/* Barre de filtres */}
      <div className="mb-4 flex flex-wrap gap-3 items-end">

        {/* Recherche */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">🔍</span>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={searchPh}
            className="input pl-9 py-1.5"
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

        {/* Filtre statut */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium whitespace-nowrap">{filterStatutLabel}</span>
          <select
            value={filterStatut}
            onChange={e => setFilterStatut(e.target.value)}
            className={selectCls}
          >
            <option value="">{filterAllStatuts}</option>
            {Object.entries(statutLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Filtre entité */}
        {allEntites.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 font-medium whitespace-nowrap">{filterEntiteLabel}</span>
            <select
              value={filterEntite}
              onChange={e => setFilterEntite(e.target.value)}
              className={selectCls}
            >
              <option value="">{filterAllEntites}</option>
              {allEntites.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
        )}

        {/* Filtre échéance */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium whitespace-nowrap">{filterEcheanceLabel}</span>
          <select
            value={filterEcheance}
            onChange={e => setFilterEcheance(e.target.value)}
            className={selectCls}
          >
            <option value="">—</option>
            <option value="retard">{echeanceRetard}</option>
            <option value="semaine">{echeanceSemaine}</option>
            <option value="mois">{echeanceMois}</option>
            <option value="sans">{echeanceSans}</option>
          </select>
        </div>

        {/* Effacer filtres */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-ebios-600 hover:text-ebios-800 font-medium underline whitespace-nowrap"
          >
            ✕ Effacer
          </button>
        )}
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">{hasFilters ? '🔍' : '✅'}</div>
          <p className="text-gray-500">{noActions}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{colAnalyse}</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{colMesure}</th>
                <th scope="col" className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">{colType}</th>
                <th scope="col" className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{colPriorite}</th>
                <th scope="col" className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{colStatut}</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">{colResponsable}</th>
                <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">{colEntite}</th>
                <th scope="col" className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">{colEcheance}</th>
                <th scope="col" className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(m => (
                <tr key={m.mesureId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800 text-xs">{m.analyseNom}</div>
                    {m.analyseOrg && <div className="text-gray-500 text-xs">{m.analyseOrg}</div>}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="font-medium text-gray-800">{m.nom}</div>
                    {m.description && (
                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{m.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${typeColor(m.type)}`}>
                      {typeLabels[m.type] ?? m.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${prioriteColor(m.priorite)}`}>
                      P{m.priorite}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statutColor(m.statut)}`}>
                      {statutLabels[m.statut] ?? m.statut}
                    </span>
                    {m.enRetard && (
                      <div className="text-xs text-red-500 mt-0.5 font-medium">⏰ {retard}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-gray-600">{m.responsable ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {m.entite ? (
                      <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {m.entite}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell">
                    {m.echeance ? (
                      <span className={`text-xs ${m.enRetard ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                        {new Date(m.echeance).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/analyses/${m.analyseId}/atelier/5?tab=mesures#mesure-${m.mesureId}`}
                      className="text-xs text-ebios-600 hover:text-ebios-800 font-medium hover:underline whitespace-nowrap"
                    >
                      {goToAtelier}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
            {resultCount.replace('{n}', String(filtered.length)).replace('{total}', String(total))}
          </div>
        </div>
      )}
    </>
  )
}
