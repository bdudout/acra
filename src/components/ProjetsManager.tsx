'use client'

// ─── Onglet Projets : liste des projets 360 (analyses PROJET_360) ────────────
// Recherche rapide, filtre par statut et tri par colonne (lib/projets-liste) ; le lancement d'un projet se fait dans
// sa page dédiée (/projets/nouveau) ; le portefeuille (domaines × projets) reste disponible en export Excel.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Download, Plus } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import ModuleGuide from '@/components/ModuleGuide'
import { filtrerTrierProjets, type TriProjets } from '@/lib/projets-liste'

export interface ProjetRow { id: string; nom: string; statut: string; risques: number; updatedAt: string; analyses?: { id: string; nom: string }[] }

const qualifHref = (id: string) => `/analyses/${id}/atelier/1?phase=qualification`
const field = 'rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600'

export default function ProjetsManager({ projets, canCreate }: { projets: ProjetRow[]; canCreate: boolean }) {
  const { t, locale } = useTranslation()
  const p = t.projets
  const statusLabels = t.statusLabels as Record<string, string>
  const [q, setQ] = useState('')
  const [statut, setStatut] = useState('')
  const [tri, setTri] = useState<TriProjets>('updatedAt')
  const [sens, setSens] = useState<'asc' | 'desc'>('desc')
  const statuts = useMemo(() => [...new Set(projets.map(pr => pr.statut))], [projets])
  const visibles = useMemo(() => filtrerTrierProjets(projets, { q, statut, tri, sens }), [projets, q, statut, tri, sens])

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
          <a href={`/api/projets/portefeuille?format=xlsx&lang=${locale}`} className="btn-secondary text-xs inline-flex items-center gap-1.5 ml-auto"><Download size={14} aria-hidden="true" />{p.exportPortefeuille}</a>
        </>}
      </div>
      <div className="card overflow-x-auto">
        {projets.length === 0 ? <p className="p-5 text-sm italic text-gray-400">{p.empty}</p> : visibles.length === 0 ? <p className="p-5 text-sm italic text-gray-400">{p.noMatch}</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
              {entete('nom', p.colNom)}{entete('statut', p.colStatut)}{entete('risques', p.colRisques)}
              <th className="px-4 py-2">{p.colAnalyses}</th>
              {entete('updatedAt', p.colMaj)}
            </tr></thead>
            <tbody>
              {visibles.map(pr => (
                <tr key={pr.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2 font-medium"><Link href={qualifHref(pr.id)} className="text-ebios-700 hover:underline">{pr.nom}</Link></td>
                  <td className="px-4 py-2 text-xs">{statusLabels[pr.statut] ?? pr.statut}</td>
                  <td className="px-4 py-2 tabular-nums">{pr.risques}</td>
                  <td className="px-4 py-2 text-xs">
                    <ul className="space-y-0.5">
                      {(pr.analyses ?? []).map(a => <li key={a.id}><Link href={`/analyses/${a.id}`} className="text-ebios-700 hover:underline">{a.nom}</Link></li>)}
                    </ul>
                    {canCreate && <Link href={`/analyses/new?projet=${pr.id}`} title={p.startCyberTitle} className="mt-1 inline-flex items-center gap-1 rounded border border-ebios-300 px-2 py-0.5 font-medium text-ebios-700 hover:bg-ebios-50 dark:border-ebios-700 dark:hover:bg-gray-800">{p.startCyber}</Link>}
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
