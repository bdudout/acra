'use client'

// ─── Onglet Projets : liste des projets 360 (analyses PROJET_360) ────────────
// Recherche rapide, filtre par statut et tri par colonne (lib/projets-liste) ; le lancement d'un projet se fait dans
// sa page dédiée (/projets/nouveau) ; le portefeuille (domaines × projets) reste disponible en export Excel.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Download, Plus } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import ModuleGuide from '@/components/ModuleGuide'
import AssocierAnalyseCyber from '@/components/projet360/AssocierAnalyseCyber'
import VueListeToggle, { useModeVue } from '@/components/VueListeToggle'
import { Cloud, CloudLightning, CloudSun, Sun, type LucideIcon } from 'lucide-react'
import { filtrerTrierProjets, type TriProjets } from '@/lib/projets-liste'

export interface ProjetRow { id: string; nom: string; statut: string; risques: number; updatedAt: string; analyses?: { id: string; nom: string }[]
  /** Météo réglée par le chef de projet (lib/projet-meteo) et date de mise en service (AAAA-MM-JJ). */
  meteo?: string | null; miseEnService?: string | null }

const METEO_ICONE: Record<string, LucideIcon> = { SOLEIL: Sun, SOLEIL_NUAGE: CloudSun, NUAGE: Cloud, ORAGE: CloudLightning }
const METEO_COULEUR: Record<string, string> = { SOLEIL: 'text-amber-500', SOLEIL_NUAGE: 'text-amber-400', NUAGE: 'text-gray-500', ORAGE: 'text-red-600' }
const field = 'rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600'

export default function ProjetsManager({ projets, canCreate }: { projets: ProjetRow[]; canCreate: boolean }) {
  const { t, locale } = useTranslation()
  const p = t.projets
  const statusLabels = t.statusLabels as Record<string, string>
  const [q, setQ] = useState('')
  const [statut, setStatut] = useState('')
  const [tri, setTri] = useState<TriProjets>('updatedAt')
  const [sens, setSens] = useState<'asc' | 'desc'>('desc')
  // Présentation : liste simple (défaut) ou cartes détaillées, mémorisée par navigateur.
  const [modeVue, setModeVue] = useModeVue('acra-vue-projets', 'liste')
  const meteos = t.projet360.presentation.meteo as Record<string, string>
  // Analyses liées depuis cette page (le bouton « Associer une analyse cyber » disparaît une fois l'association faite).
  const [liees, setLiees] = useState<Record<string, { id: string; nom: string }[]>>({})
  const lignes = useMemo(() => projets.map(pr => (liees[pr.id] ? { ...pr, analyses: [...(pr.analyses ?? []), ...liees[pr.id]] } : pr)), [projets, liees])
  const statuts = useMemo(() => [...new Set(lignes.map(pr => pr.statut))], [lignes])
  const visibles = useMemo(() => filtrerTrierProjets(lignes, { q, statut, tri, sens }), [lignes, q, statut, tri, sens])

  // Premier clic : sens naturel de la colonne (texte croissant, nombres et dates décroissants) ; clic suivant : inverse.
  function trierPar(col: TriProjets) {
    if (col === tri) setSens(s => (s === 'asc' ? 'desc' : 'asc'))
    else { setTri(col); setSens(col === 'nom' || col === 'statut' ? 'asc' : 'desc') }
  }
  const entete = (col: TriProjets, label: string) => (
    <th className="px-4 py-2" aria-sort={tri === col ? (sens === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => trierPar(col)} aria-label={p.sortBy.replace('{col}', label)} className="inline-flex items-center gap-1 uppercase hover:text-gray-800 dark:hover:text-gray-200">
        {label}{tri === col && (sens === 'asc' ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
      </button>
    </th>
  )

  return (
    <div className="space-y-5">
      <ModuleGuide guide={p.guide} />
      <div className="flex flex-wrap items-end gap-3">
        {canCreate && <Link href="/projets/nouveau" className="btn-primary text-sm inline-flex items-center gap-1.5"><Plus size={15} aria-hidden="true" />{p.launch}</Link>}
        {projets.length > 0 && <>
          <label className="text-xs text-gray-600 dark:text-gray-300">{p.search}
            <input aria-label={p.search} type="search" value={q} placeholder={p.searchPlaceholder} onChange={e => setQ(e.target.value)} className={`${field} mt-1 block w-60`} />
          </label>
          <label className="text-xs text-gray-600 dark:text-gray-300">{p.statutFilter}
            <select aria-label={p.statutFilter} value={statut} onChange={e => setStatut(e.target.value)} className={`${field} mt-1 block`}>
              <option value="">{p.allStatuts}</option>
              {statuts.map(s => <option key={s} value={s}>{statusLabels[s] ?? s}</option>)}
            </select>
          </label>
          <div className="ml-auto flex items-center gap-2">
            <VueListeToggle mode={modeVue} onChange={setModeVue} />
            <a href={`/api/projets/portefeuille?format=xlsx&lang=${locale}`} className="btn-secondary text-xs inline-flex items-center gap-1.5"><Download size={14} aria-hidden="true" />{p.exportPortefeuille}</a>
          </div>
        </>}
      </div>
      <div className="card overflow-x-auto">
        {projets.length === 0 ? <p className="p-5 text-sm italic text-gray-400">{p.empty}</p> : visibles.length === 0 ? <p className="p-5 text-sm italic text-gray-400">{p.noMatch}</p> : modeVue === 'detail' ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibles.map(pr => {
              const Meteo = pr.meteo ? METEO_ICONE[pr.meteo] : null
              return (
                <article key={pr.id} aria-label={pr.nom} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/projets/${pr.id}`} className="font-semibold text-ebios-700 hover:underline">{pr.nom}</Link>
                    {Meteo && <Meteo size={22} aria-hidden="true" className={METEO_COULEUR[pr.meteo!] ?? 'text-gray-500'} />}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{statusLabels[pr.statut] ?? pr.statut}</p>
                  {pr.meteo && <p className="mt-1 text-xs font-medium text-gray-700 dark:text-gray-200">{meteos[pr.meteo] ?? pr.meteo}</p>}
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-gray-500">{p.colRisques}</dt><dd className="font-semibold tabular-nums text-gray-800 dark:text-gray-100">{pr.risques}</dd></div>
                    <div><dt className="text-gray-500">{t.projet360.presentation.miseEnService}</dt><dd className="font-semibold text-gray-800 dark:text-gray-100">{pr.miseEnService ? new Date(`${pr.miseEnService}T00:00:00`).toLocaleDateString(locale) : '—'}</dd></div>
                  </dl>
                  <div className="mt-3 text-xs">
                    {(pr.analyses ?? []).map(a => <Link key={a.id} href={`/analyses/${a.id}`} className="block text-ebios-700 hover:underline">{a.nom}</Link>)}
                    {canCreate && (pr.analyses ?? []).length === 0 && <AssocierAnalyseCyber compact projetId={pr.id} canCreate={canCreate} onLinked={a => setLiees(m => ({ ...m, [pr.id]: [...(m[pr.id] ?? []), a] }))} />}
                  </div>
                  <p className="mt-3 text-[11px] text-gray-400">{p.colMaj} {new Date(pr.updatedAt).toLocaleDateString(locale)}</p>
                </article>
              )
            })}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
              {entete('nom', p.colNom)}{entete('statut', p.colStatut)}{entete('risques', p.colRisques)}
              <th className="px-4 py-2">{p.colAnalyses}</th>
              {entete('updatedAt', p.colMaj)}
            </tr></thead>
            <tbody>
              {visibles.map(pr => (
                <tr key={pr.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2 font-medium"><Link href={`/projets/${pr.id}`} className="text-ebios-700 hover:underline">{pr.nom}</Link></td>
                  <td className="px-4 py-2 text-xs">{statusLabels[pr.statut] ?? pr.statut}</td>
                  <td className="px-4 py-2 tabular-nums">{pr.risques}</td>
                  <td className="px-4 py-2 text-xs">
                    <ul className="space-y-0.5">
                      {(pr.analyses ?? []).map(a => <li key={a.id}><Link href={`/analyses/${a.id}`} className="text-ebios-700 hover:underline">{a.nom}</Link></li>)}
                    </ul>
                    {canCreate && (pr.analyses ?? []).length === 0 && (
                      <AssocierAnalyseCyber compact projetId={pr.id} canCreate={canCreate}
                        onLinked={a => setLiees(m => ({ ...m, [pr.id]: [...(m[pr.id] ?? []), a] }))} />
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">{new Date(pr.updatedAt).toLocaleDateString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
