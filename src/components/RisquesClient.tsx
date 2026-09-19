'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Ban, Building2, CheckCircle2, ChevronDown, Eye, Search, type LucideIcon } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import ColumnMenu from '@/components/ColumnMenu'
import { nextSort, sortRows, type SortState, type SortDir } from '@/lib/table-sort'
import { distinctValues, applyColumnFilters, toggleColumnValue, onlyColumnValue, clearColumnFilter, type ColumnFilters } from '@/lib/table-filter'

// Couleur badge selon score de risque
function niveauColor(score: number) {
  if (score >= 12) return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', label: 'Critique' }
  if (score >= 8)  return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', label: 'Élevé' }
  if (score >= 4)  return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', label: 'Modéré' }
  return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', label: 'Faible' }
}

// Icônes des stratégies (le libellé texte vient de l'i18n t.strategyLabels)
const STRATEGY_ICONS: Record<string, LucideIcon> = {
  REDUIRE: ChevronDown, ACCEPTER: CheckCircle2, TRANSFERER: ArrowUpRight, REFUSER: Ban, SURVEILLER: Eye,
}

export interface RisqueRow {
  analyseId:    string
  analyseNom:   string
  analyseOrg:   string | null
  entite?:      string | null  // organisation (multi-org), en vue consolidée uniquement
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
  const { t } = useTranslation()
  const trL = (l: string) => (t.scaleDefaults as Record<string, string>)[l] ?? l
  const stratLabel = (s: string) => (t.strategyLabels as Record<string, string>)[s] ?? s
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortState | null>(null)
  const onSort = (key: string) => setSort((s) => nextSort(s, key))
  const onSortDir = (key: string, dir: SortDir) => setSort({ key, dir })
  const [colFilters, setColFilters] = useState<ColumnFilters>({})

  const searched = search.trim()
    ? risques.filter(r =>
        r.nom.toLowerCase().includes(search.toLowerCase()) ||
        r.analyseNom.toLowerCase().includes(search.toLowerCase())
      )
    : risques

  // Tri par rang (score/résiduel numériques) et filtres auto par libellé.
  const accessor = (r: RisqueRow, key: string): unknown => {
    switch (key) {
      case 'analyse': return r.analyseNom
      case 'risque': return r.nom
      case 'score': return r.niveauRisque
      case 'strategie': return stratLabel(r.strategie)
      case 'residuel': return r.niveauResiduel
      case 'mesures': return r.mesuresCount
      default: return ''
    }
  }
  const display = (r: RisqueRow, key: string): unknown => {
    switch (key) {
      case 'analyse': return r.analyseNom
      case 'entite': return r.entite ?? ''
      case 'strategie': return stratLabel(r.strategie)
      default: return ''
    }
  }
  const distinctFor = (key: string) => distinctValues(searched, (r) => display(r, key))
  const colFiltered = applyColumnFilters(searched, colFilters, display)
  const filtered = sort ? sortRows(colFiltered, sort, accessor) : colFiltered
  const onColToggle = (key: string, value: string) => setColFilters((f) => toggleColumnValue(f, key, value, distinctFor(key)))
  const onColOnly = (key: string, value: string) => setColFilters((f) => onlyColumnValue(f, key, value))
  const onColClear = (key: string) => setColFilters((f) => clearColumnFilter(f, key))

  return (
    <>
      {/* Barre de recherche */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><Search size={18} aria-hidden="true" /></span>
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
          <div className="mb-3 flex justify-center">{search ? <Search size={40} className="text-gray-300" aria-hidden="true" /> : <CheckCircle2 size={40} className="text-green-500" aria-hidden="true" />}</div>
          <p className="text-gray-500">
            {search ? `Aucun risque correspondant à « ${search} »` : noRisks}
          </p>
        </div>
      ) : (<>
        <div className="space-y-2 sm:hidden">
          {filtered.map(r => {
            const c = niveauColor(r.niveauRisque)
            const cRes = r.niveauResiduel !== null ? niveauColor(r.niveauResiduel) : null
            return <div key={r.risqueId} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><div className="font-medium text-gray-800">{r.nom}</div><div className="mt-0.5 text-xs text-gray-500">{r.analyseNom}</div></div>
                <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${c.bg} ${c.text} ${c.border}`}>{r.niveauRisque}/16</span>
              </div>
              {r.description && <div className="mt-2 text-xs text-gray-500 line-clamp-2">{r.description}</div>}
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">{stratLabel(r.strategie)}</span>
                {cRes && <span className={`rounded-full border px-2 py-0.5 font-medium ${cRes.bg} ${cRes.text} ${cRes.border}`}>{colResiduel} {r.niveauResiduel}/16</span>}
                <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">{colMesures} {r.mesuresCount}</span>
              </div>
              <Link href={`/analyses/${r.analyseId}/atelier/5`} className="mt-3 inline-block text-xs font-medium text-ebios-600 hover:underline">{goToAtelier}</Link>
            </div>
          })}
        </div>
        <div className="hidden card overflow-hidden sm:block">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <ColumnMenu label={colAnalyse} sortKey="analyse" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => setSort(null)} className="text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  values={distinctFor('analyse')} allowed={colFilters.analyse} onToggle={onColToggle} onOnly={onColOnly} onClearFilter={onColClear} />
                <ColumnMenu label={colRisque} sortKey="risque" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => setSort(null)} className="text-xs font-semibold text-gray-500 uppercase tracking-wide" />
                <ColumnMenu label={colScore} sortKey="score" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => setSort(null)} align="center" className="text-xs font-semibold text-gray-500 uppercase tracking-wide" />
                <ColumnMenu label={colStrategie} sortKey="strategie" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => setSort(null)} align="center" className="text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell"
                  values={distinctFor('strategie')} allowed={colFilters.strategie} onToggle={onColToggle} onOnly={onColOnly} onClearFilter={onColClear} />
                <ColumnMenu label={colResiduel} sortKey="residuel" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => setSort(null)} align="center" className="text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell" />
                <ColumnMenu label={colMesures} sortKey="mesures" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => setSort(null)} align="center" className="text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell" />
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
                      {r.entite && (
                        <div className="mt-0.5 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-600">
                          <Building2 size={10} aria-hidden="true" /> {r.entite}
                        </div>
                      )}
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
                      <div className="text-xs text-gray-500 mt-0.5">{trL(c.label)}</div>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className="text-xs text-gray-600 inline-flex items-center gap-1">{(() => { const SI = STRATEGY_ICONS[r.strategie]; return SI ? <SI size={13} aria-hidden="true" /> : null })()}{(t.strategyLabels as Record<string, string>)[r.strategie] ?? r.strategie}</span>
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
      </>)}
    </>
  )
}
