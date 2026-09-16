'use client'

// Vue transverse des plans d'action : agrège mesures d'analyse, actions du
// registre, recommandations d'audit, anomalies de contrôle et incidents. Les
// items arrivent sérialisés (échéance en ISO) ; on réhydrate en Date puis on
// délègue filtre/tri/synthèse à la lib pure `action-items`.

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import {
  filterActionItems,
  sortActionItems,
  summarizeActionItems,
  ACTION_ORIGINES,
  type ActionItem,
  type ActionOrigine,
  type ActionItemFiltre,
} from '@/lib/action-items'
import { effectiveStatut, ACTION_PRIORITES, type ActionPriorite } from '@/lib/risk-action'
import ColumnMenu from '@/components/ColumnMenu'
import PlanActionEditor from '@/components/PlanActionEditor'
import { nextSort, sortRows, type SortState, type SortDir } from '@/lib/table-sort'
import { distinctValues, applyColumnFilters, toggleColumnValue, onlyColumnValue, clearColumnFilter, type ColumnFilters } from '@/lib/table-filter'

export interface SerializedActionItem extends Omit<ActionItem, 'echeance'> {
  echeance: string | null
}

interface Props {
  items: SerializedActionItem[]
  /** Organisation active — requis pour éditer une action orpheline en place. */
  orgId?: string
  /** Filtres initiaux (deep-links, ex. /actions?priorite=1 → CRITIQUE, ?filtre=retard). */
  initialPriorite?: ActionPriorite | ''
  initialEcheance?: string
}

const PRIORITE_STYLE: Record<ActionPriorite, string> = {
  CRITIQUE: 'bg-red-100 text-red-800',
  MAJEUR: 'bg-orange-100 text-orange-800',
  MODERE: 'bg-yellow-100 text-yellow-800',
}
const STATUT_STYLE: Record<string, string> = {
  A_FAIRE: 'bg-gray-100 text-gray-700',
  EN_COURS: 'bg-blue-100 text-blue-800',
  FAIT: 'bg-green-100 text-green-800',
  EN_RETARD: 'bg-amber-100 text-amber-900',
}
// Facette métier d'origine (typologie de plan d'action).
const ORIGINE_STYLE: Record<ActionOrigine, string> = {
  risque: 'bg-purple-50 text-purple-700 border-purple-200',
  conformite: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  controle: 'bg-sky-50 text-sky-700 border-sky-200',
  audit: 'bg-teal-50 text-teal-700 border-teal-200',
  regulateur: 'bg-amber-50 text-amber-800 border-amber-200',
  incident: 'bg-rose-50 text-rose-700 border-rose-200',
  // Orpheline = alerte : action non rattachée à une source.
  orpheline: 'bg-red-100 text-red-800 border-red-300 font-semibold',
}

export default function PlansActionsView({ items, orgId, initialPriorite = '', initialEcheance = '' }: Props) {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const now = useMemo(() => new Date(), [])

  // Édition en place d'une action ORPHELINE (aucune fiche source où l'ouvrir) —
  // réutilise l'éditeur commun PlanActionEditor (option 2, aussi utilisée en conformité).
  const [editId, setEditId] = useState<string | null>(null)

  const [origine, setOrigine] = useState<ActionOrigine | ''>('')
  const [priorite, setPriorite] = useState<ActionPriorite | ''>(initialPriorite)
  const [statut, setStatut] = useState<string>('')
  const [echeance, setEcheance] = useState<string>(initialEcheance)
  const [porteur, setPorteur] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortState | null>(null)
  const onSort = (key: string) => setSort((s) => nextSort(s, key))
  const onSortDir = (key: string, dir: SortDir) => setSort({ key, dir })
  const [colFilters, setColFilters] = useState<ColumnFilters>({})

  // Réhydratation ISO → Date (une fois).
  const hydrated = useMemo<ActionItem[]>(
    () => items.map((i) => ({ ...i, echeance: i.echeance ? new Date(i.echeance) : null })),
    [items],
  )

  const filtre: ActionItemFiltre = useMemo(() => {
    const f: ActionItemFiltre = {}
    if (origine) f.origine = origine
    if (priorite) f.priorite = priorite
    if (statut) f.statut = statut as ActionItemFiltre['statut']
    if (echeance) f.echeanceBucket = echeance as ActionItemFiltre['echeanceBucket']
    if (porteur.trim()) f.porteur = porteur
    if (q.trim()) f.q = q
    return f
  }, [origine, priorite, statut, echeance, porteur, q])

  // Accès aux valeurs par colonne (tri). Priorité/statut triés par rang métier
  // (pas alphabétique) ; origine par libellé traduit ; échéance par date.
  const PRIORITE_RANK: Record<ActionPriorite, number> = { CRITIQUE: 0, MAJEUR: 1, MODERE: 2 }
  const STATUT_RANK: Record<string, number> = { EN_RETARD: 0, A_FAIRE: 1, EN_COURS: 2, FAIT: 3 }
  const accessor = (it: ActionItem, key: string): unknown => {
    switch (key) {
      case 'titre': return it.titre
      case 'origine': return t.plansActions.origines[it.origine]
      case 'porteur': return it.porteur
      case 'priorite': return PRIORITE_RANK[it.priorite]
      case 'statut': return STATUT_RANK[effectiveStatut(it, now)]
      case 'echeance': return it.echeance
      default: return ''
    }
  }

  // Libellé affiché d'une colonne (base des filtres auto « façon tableur »).
  const display = (it: ActionItem, key: string): unknown => {
    switch (key) {
      case 'origine': return t.plansActions.origines[it.origine]
      case 'porteur': return it.porteur ?? ''
      case 'priorite': return t.plansActions.priorites[it.priorite]
      case 'statut': return t.plansActions.statuts[effectiveStatut(it, now)]
      default: return ''
    }
  }
  // Liste après filtres à facettes (barre) — base des valeurs distinctes des colonnes.
  const facetted = useMemo(() => filterActionItems(hydrated, filtre, now), [hydrated, filtre, now])
  const distinctFor = (key: string) => distinctValues(facetted, (it) => display(it, key)) // eslint-disable-line react-hooks/exhaustive-deps

  const visibles = useMemo(() => {
    const colFiltered = applyColumnFilters(facetted, colFilters, display)
    // Tri par colonne si actif, sinon tri métier par défaut (retards/priorité).
    return sort ? sortRows(colFiltered, sort, accessor) : sortActionItems(colFiltered, now)
  }, [facetted, colFilters, now, sort]) // eslint-disable-line react-hooks/exhaustive-deps
  const summary = useMemo(() => summarizeActionItems(hydrated, now), [hydrated, now])
  const orphanCount = useMemo(() => hydrated.filter((i) => i.origine === 'orpheline').length, [hydrated])

  const hasFilter = !!(origine || priorite || statut || echeance || porteur.trim() || q.trim() || Object.keys(colFilters).length)
  const clearAll = () => { setOrigine(''); setPriorite(''); setStatut(''); setEcheance(''); setPorteur(''); setQ(''); setColFilters({}) }
  const onColToggle = (key: string, value: string) => setColFilters((f) => toggleColumnValue(f, key, value, distinctFor(key)))
  const onColOnly = (key: string, value: string) => setColFilters((f) => onlyColumnValue(f, key, value))
  const onColClear = (key: string) => setColFilters((f) => clearColumnFilter(f, key))

  const fmtDate = (d: Date | null) =>
    d ? new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d) : t.plansActions.sansEcheance

  return (
    <div>
      {/* En-tête */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t.plansActions.title}</h1>
        <p className="text-gray-500 text-sm mt-0.5 max-w-3xl">{t.plansActions.subtitle}</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3 mb-6 max-w-lg">
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">{t.plansActions.kpiTotal}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className={`text-2xl font-bold ${summary.enRetard ? 'text-amber-700' : 'text-gray-900'}`}>{summary.enRetard}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">{t.plansActions.kpiRetard}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{summary.tauxAvancement}%</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">{t.plansActions.kpiAvancement}</div>
        </div>
      </div>

      {/* Alerte actions orphelines (non rattachées à une source) */}
      {orphanCount > 0 && (
        <button type="button" onClick={() => setOrigine('orpheline')}
          className="mb-4 flex w-full items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-left text-sm text-red-800 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          <span aria-hidden="true">⚠</span>
          <span>{t.plansActions.orphanAlert.replace('{n}', String(orphanCount))}</span>
        </button>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="flex flex-col gap-1 text-xs text-gray-500 min-w-0">
          <span className="font-medium">{t.plansActions.filterOrigine}</span>
          <select value={origine} onChange={(e) => setOrigine(e.target.value as ActionOrigine | '')}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800 bg-white min-w-[10rem]">
            <option value="">{t.plansActions.filterAll}</option>
            {ACTION_ORIGINES.map((o) => <option key={o} value={o}>{t.plansActions.origines[o]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500 min-w-0">
          <span className="font-medium">{t.plansActions.filterPriorite}</span>
          <select value={priorite} onChange={(e) => setPriorite(e.target.value as ActionPriorite | '')}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800 bg-white min-w-[9rem]">
            <option value="">{t.plansActions.filterAll}</option>
            {ACTION_PRIORITES.map((p) => <option key={p} value={p}>{t.plansActions.priorites[p]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500 min-w-0">
          <span className="font-medium">{t.plansActions.filterStatut}</span>
          <select value={statut} onChange={(e) => setStatut(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800 bg-white min-w-[9rem]">
            <option value="">{t.plansActions.filterAll}</option>
            {(['A_FAIRE', 'EN_COURS', 'FAIT', 'EN_RETARD'] as const).map((s) => (
              <option key={s} value={s}>{t.plansActions.statuts[s]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500 min-w-0">
          <span className="font-medium">{t.plansActions.filterEcheance}</span>
          <select value={echeance} onChange={(e) => setEcheance(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800 bg-white min-w-[9rem]">
            <option value="">{t.plansActions.filterAll}</option>
            <option value="retard">{t.plansActions.echeanceRetard}</option>
            <option value="semaine">{t.plansActions.echeanceSemaine}</option>
            <option value="mois">{t.plansActions.echeanceMois}</option>
            <option value="sans">{t.plansActions.echeanceSans}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500 min-w-0">
          <span className="font-medium">{t.plansActions.filterPorteur}</span>
          <input value={porteur} onChange={(e) => setPorteur(e.target.value)} type="text"
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800 bg-white min-w-[9rem]" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500 flex-1 min-w-[12rem]">
          <span className="font-medium">&nbsp;</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder={t.plansActions.searchPh}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800 bg-white w-full" />
        </label>
        {hasFilter && (
          <button onClick={clearAll} className="text-sm text-gray-600 hover:text-gray-900 underline py-1.5">
            {t.plansActions.clear}
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-2">
        {t.plansActions.resultCount.replace('{n}', String(visibles.length)).replace('{total}', String(hydrated.length))}
      </p>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
              <ColumnMenu label={t.plansActions.colTitre} sortKey="titre" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => setSort(null)} />
              <ColumnMenu label={t.plansActions.colOrigine} sortKey="origine" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => setSort(null)}
                values={distinctFor('origine')} allowed={colFilters.origine} onToggle={onColToggle} onOnly={onColOnly} onClearFilter={onColClear} />
              <ColumnMenu label={t.plansActions.colPorteur} sortKey="porteur" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => setSort(null)}
                values={distinctFor('porteur')} allowed={colFilters.porteur} onToggle={onColToggle} onOnly={onColOnly} onClearFilter={onColClear} />
              <ColumnMenu label={t.plansActions.colPriorite} sortKey="priorite" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => setSort(null)}
                values={distinctFor('priorite')} allowed={colFilters.priorite} onToggle={onColToggle} onOnly={onColOnly} onClearFilter={onColClear} />
              <ColumnMenu label={t.plansActions.colStatut} sortKey="statut" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => setSort(null)}
                values={distinctFor('statut')} allowed={colFilters.statut} onToggle={onColToggle} onOnly={onColOnly} onClearFilter={onColClear} />
              <ColumnMenu label={t.plansActions.colEcheance} sortKey="echeance" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => setSort(null)} />
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">{t.plansActions.empty}</td></tr>
            )}
            {visibles.map((it) => {
              const eff = effectiveStatut(it, now)
              const isOrphan = it.origine === 'orpheline'
              const editing = editId === it.sourceId && isOrphan
              return (
                <Fragment key={it.id}>
                <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-900 max-w-md">
                    <div className="font-medium">{it.titre}</div>
                    {it.description && <div className="text-xs text-gray-500 line-clamp-1">{it.description}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded border ${ORIGINE_STYLE[it.origine]}`}>
                      {it.origine === 'orpheline' && <span aria-hidden="true">⚠ </span>}
                      {t.plansActions.origines[it.origine]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{it.porteur ?? <span className="text-gray-400">{t.plansActions.sansPorteur}</span>}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${PRIORITE_STYLE[it.priorite]}`}>
                      {t.plansActions.priorites[it.priorite]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${STATUT_STYLE[eff]}`}>
                      {t.plansActions.statuts[eff]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtDate(it.echeance)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {it.lien
                      ? <Link href={it.lien} className="text-blue-600 hover:underline text-xs font-medium">{t.plansActions.open}</Link>
                      : isOrphan && orgId
                        ? <button type="button" onClick={() => setEditId(editing ? null : it.sourceId)} className="text-blue-600 hover:underline text-xs font-medium">{t.plansActions.open}</button>
                        : null}
                  </td>
                </tr>
                {editing && orgId && (
                  <tr className="bg-red-50/40 border-b border-gray-100">
                    <td colSpan={7} className="px-3 py-2">
                      <PlanActionEditor orgId={orgId}
                        action={{ id: it.sourceId, titre: it.titre, porteur: it.porteur, echeance: it.echeance ? it.echeance.toISOString() : null, priorite: it.priorite, statut: it.statut }}
                        onSaved={() => { setEditId(null); router.refresh() }}
                        onCancel={() => setEditId(null)} />
                    </td>
                  </tr>
                )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
