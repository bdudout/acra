'use client'

// Vue transverse des plans d'action : agrège mesures d'analyse, actions du
// registre, recommandations d'audit, anomalies de contrôle et incidents. Les
// items arrivent sérialisés (échéance en ISO) ; on réhydrate en Date puis on
// délègue filtre/tri/synthèse à la lib pure `action-items`.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'
import {
  filterActionItems,
  sortActionItems,
  summarizeActionItems,
  ACTION_SOURCES,
  type ActionItem,
  type ActionSource,
  type ActionItemFiltre,
} from '@/lib/action-items'
import { effectiveStatut, ACTION_PRIORITES, type ActionPriorite } from '@/lib/risk-action'

export interface SerializedActionItem extends Omit<ActionItem, 'echeance'> {
  echeance: string | null
}

interface Props {
  items: SerializedActionItem[]
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
const SOURCE_STYLE: Record<ActionSource, string> = {
  MESURE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  RISK_ACTION: 'bg-purple-50 text-purple-700 border-purple-200',
  AUDIT: 'bg-teal-50 text-teal-700 border-teal-200',
  CONTROLE: 'bg-sky-50 text-sky-700 border-sky-200',
  INCIDENT: 'bg-rose-50 text-rose-700 border-rose-200',
}

export default function PlansActionsView({ items }: Props) {
  const { t, locale } = useTranslation()
  const now = useMemo(() => new Date(), [])

  const [source, setSource] = useState<ActionSource | ''>('')
  const [priorite, setPriorite] = useState<ActionPriorite | ''>('')
  const [statut, setStatut] = useState<string>('')
  const [porteur, setPorteur] = useState('')
  const [q, setQ] = useState('')

  // Réhydratation ISO → Date (une fois).
  const hydrated = useMemo<ActionItem[]>(
    () => items.map((i) => ({ ...i, echeance: i.echeance ? new Date(i.echeance) : null })),
    [items],
  )

  const filtre: ActionItemFiltre = useMemo(() => {
    const f: ActionItemFiltre = {}
    if (source) f.source = source
    if (priorite) f.priorite = priorite
    if (statut) f.statut = statut as ActionItemFiltre['statut']
    if (porteur.trim()) f.porteur = porteur
    if (q.trim()) f.q = q
    return f
  }, [source, priorite, statut, porteur, q])

  const visibles = useMemo(
    () => sortActionItems(filterActionItems(hydrated, filtre, now), now),
    [hydrated, filtre, now],
  )
  const summary = useMemo(() => summarizeActionItems(hydrated, now), [hydrated, now])

  const hasFilter = !!(source || priorite || statut || porteur.trim() || q.trim())
  const clearAll = () => { setSource(''); setPriorite(''); setStatut(''); setPorteur(''); setQ('') }

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

      {/* Filtres */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="flex flex-col gap-1 text-xs text-gray-500 min-w-0">
          <span className="font-medium">{t.plansActions.filterSource}</span>
          <select value={source} onChange={(e) => setSource(e.target.value as ActionSource | '')}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800 bg-white min-w-[10rem]">
            <option value="">{t.plansActions.filterAll}</option>
            {ACTION_SOURCES.map((s) => <option key={s} value={s}>{t.plansActions.sources[s]}</option>)}
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
              <th className="px-3 py-2 font-medium">{t.plansActions.colTitre}</th>
              <th className="px-3 py-2 font-medium">{t.plansActions.colSource}</th>
              <th className="px-3 py-2 font-medium">{t.plansActions.colPorteur}</th>
              <th className="px-3 py-2 font-medium">{t.plansActions.colPriorite}</th>
              <th className="px-3 py-2 font-medium">{t.plansActions.colStatut}</th>
              <th className="px-3 py-2 font-medium">{t.plansActions.colEcheance}</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">{t.plansActions.empty}</td></tr>
            )}
            {visibles.map((it) => {
              const eff = effectiveStatut(it, now)
              return (
                <tr key={it.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-900 max-w-md">
                    <div className="font-medium">{it.titre}</div>
                    {it.description && <div className="text-xs text-gray-500 line-clamp-1">{it.description}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded border ${SOURCE_STYLE[it.source]}`}>
                      {t.plansActions.sources[it.source]}
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
                    {it.lien && <Link href={it.lien} className="text-blue-600 hover:underline text-xs font-medium">{t.plansActions.open}</Link>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
