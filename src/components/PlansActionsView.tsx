'use client'

// ─── Vue unifiée des plans d'action (page /actions) ───────────────────────────
//
// Table transverse agrégeant TOUTES les actions à mener, par ORIGINE métier
// (facettes : risque, conformité, contrôle, audit, régulateur, incident,
// résilience, préconisation, orpheline).
//
// Liste paginée CÔTÉ SERVEUR (lot V1, GET /api/actions?page=…) : facettes
// (origine/priorité/statut/échéance/porteur/q), filtre par entité, filtres PAR
// COLONNE façon tableur, tri et compteurs sont calculés sur le serveur avec les
// mêmes règles (lib action-items-liste) ; l'état vit dans l'URL (useListePaginee),
// deep-links historiques compris (?priorite=1, ?filtre=retard, ?statut=EN_RETARD).
// Les filtres de colonne circulent en CODES (origine, priorité, statut) et sont
// traduits ici à l'affichage. En-têtes = composant réutilisable `ColumnMenu`.
//
// Actions ORPHELINES (aucun lien source) : bandeau d'alerte + édition EN PLACE
// via l'éditeur réutilisable `PlanActionEditor` (PATCH plans-actions).

import { Fragment, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'
import { ACTION_ORIGINES, type ActionItem, type ActionOrigine } from '@/lib/action-items'
import { effectiveStatut, ACTION_PRIORITES, type ActionPriorite } from '@/lib/risk-action'
import ColumnMenu from '@/components/ColumnMenu'
import PlanActionEditor from '@/components/PlanActionEditor'
import Pagination from '@/components/Pagination'
import { nextSort, type SortState, type SortDir } from '@/lib/table-sort'
import { toggleColumnValue, onlyColumnValue, clearColumnFilter, type ColumnFilters } from '@/lib/table-filter'
import FiltreEntite from '@/components/FiltreEntite'
import { useReferentielEntites } from '@/lib/use-referentiel-entites'
import { useListePaginee } from '@/lib/use-liste-paginee'
import type { MetaPagination } from '@/lib/pagination'
import { lireColonnes, ecrireColonnes, prioriteDepuisUrl, echeanceDepuisUrl, type ColonneFiltrable, type SyntheseActions } from '@/lib/action-items-liste'

export interface SerializedActionItem extends Omit<ActionItem, 'echeance'> {
  echeance: string | null
}

interface ReponseActions {
  items: SerializedActionItem[]
  pagination?: MetaPagination
  synthese?: SyntheseActions
  valeurs?: Record<ColonneFiltrable, string[]>
}

interface Props {
  /** Organisation active — requis pour éditer une action orpheline en place. */
  orgId?: string
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
  resilience: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  preconisation: 'bg-lime-50 text-lime-800 border-lime-200',
  // Orpheline = alerte : action non rattachée à une source.
  orpheline: 'bg-red-100 text-red-800 border-red-300 font-semibold',
}

export default function PlansActionsView({ orgId }: Props) {
  const { t, locale } = useTranslation()
  const now = useMemo(() => new Date(), [])
  const liste = useListePaginee<ReponseActions>('/api/actions')

  // Édition en place d'une action ORPHELINE (aucune fiche source où l'ouvrir) —
  // réutilise l'éditeur commun PlanActionEditor (option 2, aussi utilisée en conformité).
  const [editId, setEditId] = useState<string | null>(null)

  // Filtres = paramètres de l'URL (deep-links historiques normalisés pour l'affichage des sélecteurs).
  const origine = liste.param('origine')
  const priorite = prioriteDepuisUrl(liste.param('priorite'))
  const statut = liste.param('statut')
  const echeance = echeanceDepuisUrl(new URLSearchParams({ echeance: liste.param('echeance'), filtre: liste.param('filtre') }))
  const porteur = liste.param('porteur')
  const filtreEntite = { id: liste.param('entite'), sous: liste.param('sousEntites') !== '0' }
  const colParam = liste.param('col')
  const colFilters = useMemo(() => lireColonnes(colParam || null), [colParam])
  const tri = liste.param('tri')
  const sort: SortState | null = tri && tri !== 'defaut' ? { key: tri, dir: liste.param('ordre') === 'desc' ? 'desc' : 'asc' } : null
  const definirTri = (s: SortState | null) => liste.definir({ tri: s?.key ?? null, ordre: s?.dir ?? null })
  const onSort = (key: string) => definirTri(nextSort(sort, key))
  const onSortDir = (key: string, dir: SortDir) => definirTri({ key, dir })

  // Page courante réhydratée (ISO → Date).
  const visibles = useMemo<ActionItem[]>(
    () => (liste.data?.items ?? []).map((i) => ({ ...i, echeance: i.echeance ? new Date(i.echeance) : null })),
    [liste.data],
  )
  const summary = liste.data?.synthese
  const orphanCount = summary?.orphelines ?? 0

  // Filtres de colonne : le serveur filtre sur des CODES ; le menu affiche des libellés traduits.
  const libelle = (key: string, code: string): string => {
    switch (key) {
      case 'origine': return t.plansActions.origines[code as ActionOrigine] ?? code
      case 'priorite': return t.plansActions.priorites[code as ActionPriorite] ?? code
      case 'statut': return t.plansActions.statuts[code as keyof typeof t.plansActions.statuts] ?? code
      default: return code
    }
  }
  const codesFor = (key: string): string[] => liste.data?.valeurs?.[key as ColonneFiltrable] ?? []
  const codeDe = (key: string, label: string) => codesFor(key).find((c) => libelle(key, c) === label) ?? label
  const distinctFor = (key: string) => codesFor(key).map((c) => libelle(key, c)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  const allowedFor = (key: string) => (colFilters[key] ? new Set([...colFilters[key]].map((c) => libelle(key, c))) : undefined)
  const definirColonnes = (c: ColumnFilters) => liste.definir({ col: ecrireColonnes(c) })
  const onColToggle = (key: string, label: string) => definirColonnes(toggleColumnValue(colFilters, key, codeDe(key, label), codesFor(key)))
  const onColOnly = (key: string, label: string) => definirColonnes(onlyColumnValue(colFilters, key, codeDe(key, label)))
  const onColClear = (key: string) => definirColonnes(clearColumnFilter(colFilters, key))

  // Filtre par entité du référentiel (lot E5) : lien ou texte libre identique, sous-entités incluses par défaut.
  const entitesRef = useReferentielEntites()

  // Saisie du porteur : l'URL (et la requête serveur) suit après une courte pause, comme la recherche.
  const [porteurSaisi, setPorteurSaisi] = useState(porteur)
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saisirPorteur = (v: string) => {
    setPorteurSaisi(v)
    if (minuterie.current) clearTimeout(minuterie.current)
    minuterie.current = setTimeout(() => liste.definir({ porteur: v.trim() ? v : null }), 300)
  }
  const hasFilter = !!(origine || priorite || statut || echeance || porteurSaisi.trim() || liste.recherche.trim() || Object.keys(colFilters).length)
  const clearAll = () => { if (minuterie.current) clearTimeout(minuterie.current); if (liste.recherche) liste.setRecherche(''); setPorteurSaisi(''); liste.definir({ origine: null, priorite: null, statut: null, echeance: null, filtre: null, porteur: null, q: null, col: null }) }
  const chargementInitial = liste.loading && !liste.data

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
          <div className="text-2xl font-bold text-gray-900">{summary?.total ?? '—'}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">{t.plansActions.kpiTotal}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className={`text-2xl font-bold ${summary?.enRetard ? 'text-amber-700' : 'text-gray-900'}`}>{summary?.enRetard ?? '—'}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">{t.plansActions.kpiRetard}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{summary ? `${summary.tauxAvancement}%` : '—'}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">{t.plansActions.kpiAvancement}</div>
        </div>
      </div>

      {/* Alerte actions orphelines (non rattachées à une source) */}
      {orphanCount > 0 && (
        <button type="button" onClick={() => liste.definir({ origine: 'orpheline' })}
          className="mb-4 flex w-full items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-left text-sm text-red-800 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          <span aria-hidden="true">⚠</span>
          <span>{t.plansActions.orphanAlert.replace('{n}', String(orphanCount))}</span>
        </button>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        {entitesRef.length > 0 && (
          <div className="flex flex-col gap-1 text-xs text-gray-500 min-w-0">
            <span className="font-medium">{t.entites.filtre.label}</span>
            <FiltreEntite entites={entitesRef} valeur={filtreEntite.id} sousEntites={filtreEntite.sous} onChange={(id, sous) => liste.definir({ entite: id || null, sousEntites: sous ? null : '0' })} />
          </div>
        )}
        <label className="flex flex-col gap-1 text-xs text-gray-500 min-w-0">
          <span className="font-medium">{t.plansActions.filterOrigine}</span>
          <select value={origine} onChange={(e) => liste.definir({ origine: e.target.value })}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800 bg-white min-w-40">
            <option value="">{t.plansActions.filterAll}</option>
            {ACTION_ORIGINES.map((o) => <option key={o} value={o}>{t.plansActions.origines[o]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500 min-w-0">
          <span className="font-medium">{t.plansActions.filterPriorite}</span>
          <select value={priorite} onChange={(e) => liste.definir({ priorite: e.target.value })}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800 bg-white min-w-36">
            <option value="">{t.plansActions.filterAll}</option>
            {ACTION_PRIORITES.map((p) => <option key={p} value={p}>{t.plansActions.priorites[p]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500 min-w-0">
          <span className="font-medium">{t.plansActions.filterStatut}</span>
          <select value={statut} onChange={(e) => liste.definir({ statut: e.target.value })}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800 bg-white min-w-36">
            <option value="">{t.plansActions.filterAll}</option>
            {(['A_FAIRE', 'EN_COURS', 'FAIT', 'EN_RETARD'] as const).map((s) => (
              <option key={s} value={s}>{t.plansActions.statuts[s]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500 min-w-0">
          <span className="font-medium">{t.plansActions.filterEcheance}</span>
          <select value={echeance} onChange={(e) => liste.definir({ echeance: e.target.value, filtre: null })}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800 bg-white min-w-36">
            <option value="">{t.plansActions.filterAll}</option>
            <option value="retard">{t.plansActions.echeanceRetard}</option>
            <option value="semaine">{t.plansActions.echeanceSemaine}</option>
            <option value="mois">{t.plansActions.echeanceMois}</option>
            <option value="sans">{t.plansActions.echeanceSans}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500 min-w-0">
          <span className="font-medium">{t.plansActions.filterPorteur}</span>
          <input value={porteurSaisi} onChange={(e) => saisirPorteur(e.target.value)} type="text"
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800 bg-white min-w-36" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500 flex-1 min-w-48">
          <span className="font-medium">&nbsp;</span>
          <input value={liste.recherche} onChange={(e) => liste.setRecherche(e.target.value)} type="search" placeholder={t.plansActions.searchPh}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800 bg-white w-full" />
        </label>
        {hasFilter && (
          <button onClick={clearAll} className="text-sm text-gray-600 hover:text-gray-900 underline py-1.5">
            {t.plansActions.clear}
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-2">
        {t.plansActions.resultCount.replace('{n}', String(liste.pagination?.total ?? visibles.length)).replace('{total}', String(summary?.total ?? visibles.length))}
      </p>

      {/* Lecture compacte : les informations déterminantes restent visibles sans
          défilement horizontal sur téléphone. */}
      <div data-testid="actions-mobile-list" className="space-y-2 md:hidden">
        {!chargementInitial && visibles.length === 0 && <div className="rounded-lg border border-gray-200 bg-white px-3 py-8 text-center text-gray-400">{t.plansActions.empty}</div>}
        {visibles.map(it => {
          const eff = effectiveStatut(it, now)
          const isOrphan = it.origine === 'orpheline'
          const editing = editId === it.sourceId && isOrphan
          return <div key={it.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><div className="font-medium text-gray-900">{it.titre}</div>{it.description && <div className="mt-0.5 text-xs text-gray-500 line-clamp-2">{it.description}</div>}</div>
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${PRIORITE_STYLE[it.priorite]}`}>{t.plansActions.priorites[it.priorite]}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
              <span className={`rounded-sm border px-2 py-0.5 ${ORIGINE_STYLE[it.origine]}`}>{t.plansActions.origines[it.origine]}</span>
              <span className={`rounded-full px-2 py-0.5 ${STATUT_STYLE[eff]}`}>{t.plansActions.statuts[eff]}</span>
              <span className="rounded-sm bg-gray-100 px-2 py-0.5 text-gray-600">{it.porteur ?? t.plansActions.sansPorteur}</span>
              <span className="rounded-sm bg-gray-100 px-2 py-0.5 text-gray-600">{fmtDate(it.echeance)}</span>
            </div>
            <div className="mt-3">
              {it.lien ? <Link href={it.lien} className="text-xs font-medium text-blue-600 hover:underline">{it.lecture ? t.plansActions.voir : t.plansActions.open}</Link>
                : isOrphan && orgId ? <button type="button" onClick={() => setEditId(editing ? null : it.sourceId)} className="text-xs font-medium text-blue-600 hover:underline">{t.plansActions.open}</button> : null}
            </div>
            {editing && orgId && <div className="mt-3 border-t border-gray-100 pt-3"><PlanActionEditor orgId={orgId} action={{ id: it.sourceId, titre: it.titre, porteur: it.porteur, echeance: it.echeance ? it.echeance.toISOString() : null, priorite: it.priorite, statut: it.statut }} onSaved={() => { setEditId(null); liste.recharger() }} onCancel={() => setEditId(null)} /></div>}
          </div>
        })}
      </div>

      {/* Table complète à partir de la tablette. */}
      <div data-testid="actions-desktop-table" className="hidden overflow-x-auto bg-white rounded-lg border border-gray-200 md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
              <ColumnMenu label={t.plansActions.colTitre} sortKey="titre" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => definirTri(null)} />
              <ColumnMenu label={t.plansActions.colOrigine} sortKey="origine" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => definirTri(null)}
                values={distinctFor('origine')} allowed={allowedFor('origine')} onToggle={onColToggle} onOnly={onColOnly} onClearFilter={onColClear} />
              <ColumnMenu label={t.plansActions.colPorteur} sortKey="porteur" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => definirTri(null)}
                values={distinctFor('porteur')} allowed={allowedFor('porteur')} onToggle={onColToggle} onOnly={onColOnly} onClearFilter={onColClear} />
              <ColumnMenu label={t.plansActions.colPriorite} sortKey="priorite" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => definirTri(null)}
                values={distinctFor('priorite')} allowed={allowedFor('priorite')} onToggle={onColToggle} onOnly={onColOnly} onClearFilter={onColClear} />
              <ColumnMenu label={t.plansActions.colStatut} sortKey="statut" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => definirTri(null)}
                values={distinctFor('statut')} allowed={allowedFor('statut')} onToggle={onColToggle} onOnly={onColOnly} onClearFilter={onColClear} />
              <ColumnMenu label={t.plansActions.colEcheance} sortKey="echeance" sort={sort} onSortCycle={onSort} onSortDir={onSortDir} onSortClear={() => definirTri(null)} />
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {!chargementInitial && visibles.length === 0 && (
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
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-sm border ${ORIGINE_STYLE[it.origine]}`}>
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
                      ? <Link href={it.lien} className="text-blue-600 hover:underline text-xs font-medium">{it.lecture ? t.plansActions.voir : t.plansActions.open}</Link>
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
                        onSaved={() => { setEditId(null); liste.recharger() }}
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
      <Pagination pagination={liste.pagination} onPage={(page) => liste.definir({ page })} onTaille={(taille) => liste.definir({ taille })} />
    </div>
  )
}
