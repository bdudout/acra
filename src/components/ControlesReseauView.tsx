'use client'

// ─── Contrôles de référence en réseau ─────────────────────────────────────────
//
// Tableau contrôle de référence × entité (dernier résultat, état d'échéance), synthèse par contrôle, déclinaison
// d'un contrôle de l'organisation dans les entités descendantes, export Excel. Cf. page /controles/reseau (P3).

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, Network } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { formatDate } from '@/lib/format'
import type { EtatCellule, Synthese } from '@/lib/controle-reseau'

interface CelluleVue { organizationId: string; controleId: string; dernierResultat: string | null; derniereExecution: string | null; etat: EtatCellule; taux: number | null }
interface Reseau {
  active: boolean; peutDecliner: boolean
  entites: { id: string; nom: string }[]
  candidats: { id: string; intitule: string }[]
  references: { id: string; intitule: string; periodicite: string; cle: boolean; cellules: CelluleVue[]; synthese: Synthese }[]
}

const COULEUR: Record<string, string> = {
  CONFORME: 'bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300',
  ANOMALIE: 'bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300',
  EN_RETARD: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  JAMAIS: 'bg-gray-50 text-gray-600 dark:bg-gray-700/30 dark:text-gray-400',
  INACTIF: 'bg-gray-100 text-gray-500 dark:bg-gray-700/40 dark:text-gray-500',
}
const BTN = 'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50'

export default function ControlesReseauView() {
  const { t, locale } = useTranslation()
  const l = t.controleReseau
  const [data, setData] = useState<Reseau | null>(null)
  const [choix, setChoix] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    const res = await fetch('/api/controles/reseau').catch(() => null)
    if (res?.ok) setData(await res.json() as Reseau)
  }, [])
  useEffect(() => { void reload() }, [reload])

  async function decliner(id: string) {
    setBusy(true); setMessage(null)
    try {
      const res = await fetch(`/api/controles/${id}/decliner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (!res.ok) { setMessage(l.failed); return }
      const r = await res.json() as { crees: string[]; ignores: unknown[]; dejaDeclinees: number }
      setMessage(l.resultat.replace('{crees}', String(r.crees.length)).replace('{ignores}', String(r.ignores.length + r.dejaDeclinees)))
      setChoix('')
      await reload()
    } catch { setMessage(l.failed) } finally { setBusy(false) }
  }

  if (!data) return null
  if (!data.active) return <p className="text-gray-600 dark:text-gray-400">{l.inactive}</p>

  const cellule = (c: CelluleVue | undefined) => {
    if (!c) return <span className="text-xs text-gray-400">{l.absent}</span>
    const cle = c.etat === 'EN_RETARD' || c.etat === 'JAMAIS' || c.etat === 'INACTIF' ? c.etat : c.dernierResultat ?? ''
    return (
      <div className={`rounded px-2 py-1 text-xs ${COULEUR[cle] ?? ''}`}>
        {c.dernierResultat && <div className="font-medium">{l.resultats[c.dernierResultat as keyof typeof l.resultats] ?? c.dernierResultat}</div>}
        <div>{l.etat[c.etat]}</div>
        {c.derniereExecution && <div className="opacity-75">{formatDate(c.derniereExecution, locale)}</div>}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white"><Network className="h-6 w-6" aria-hidden />{l.title}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{l.subtitle}</p>
        </div>
        {data.references.length > 0 && (
          <Link href="/api/controles/reseau/export" className={`${BTN} border border-gray-300 dark:border-gray-600`}><Download className="h-4 w-4" aria-hidden />{l.exporter}</Link>
        )}
      </div>

      {data.entites.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">{l.noEntites}</p>
      ) : (
        <>
          {!data.peutDecliner && <p className="text-sm text-gray-500 dark:text-gray-400">{l.readOnly}</p>}
          {data.peutDecliner && data.candidats.length > 0 && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm">{l.candidats}
                <select aria-label={l.candidats} className="mt-1 block w-full min-w-72 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm" value={choix} onChange={e => setChoix(e.target.value)}>
                  <option value="">{l.choisir}</option>
                  {data.candidats.map(c => <option key={c.id} value={c.id}>{c.intitule}</option>)}
                </select>
              </label>
              <button type="button" disabled={busy || !choix} className={`${BTN} bg-blue-600 text-white hover:bg-blue-700`} onClick={() => decliner(choix)}>{l.decliner}</button>
            </div>
          )}
          {message && <p role="status" className="text-sm text-gray-700 dark:text-gray-300">{message}</p>}

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{l.references}</h2>
          {data.references.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{l.aucuneReference}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/40 text-left text-gray-600 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2">{l.colControle}</th>
                    {data.entites.map(e => <th key={e.id} className="px-3 py-2">{e.nom}</th>)}
                    <th className="px-3 py-2">{l.taux}</th>
                    <th className="px-3 py-2">{l.colSynthese}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {data.references.map(r => {
                    const parOrg = new Map(r.cellules.map(c => [c.organizationId, c]))
                    const manquantes = data.entites.some(e => !parOrg.has(e.id))
                    return (
                      <tr key={r.id} className="align-top">
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                          {r.intitule}
                          {data.peutDecliner && manquantes && (
                            <button type="button" disabled={busy} className="mt-1 block text-xs text-blue-600 hover:underline" onClick={() => decliner(r.id)}>{l.redecliner}</button>
                          )}
                        </td>
                        {data.entites.map(e => <td key={e.id} className="px-3 py-2">{cellule(parOrg.get(e.id))}</td>)}
                        <td className="px-3 py-2">{r.synthese.taux == null ? '—' : `${r.synthese.taux} %`}</td>
                        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                          <div>{l.entitesCount.replace('{n}', String(r.synthese.entites))}</div>
                          <div>{l.enRetard.replace('{n}', String(r.synthese.enRetard))}</div>
                          <div>{l.sansExecution.replace('{n}', String(r.synthese.sansExecution))}</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
