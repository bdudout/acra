'use client'
// Administration des tâches planifiées (intégrité, 16/10/2026) : dernière exécution, échecs récents,
// relance manuelle ; livraisons webhook en échec remises en file. i18n ×5 (t.tachesPlanifiees).
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { apiErrorMessage } from '@/lib/api-error'

interface Execution { statut: string; declencheur: string; debut: string; fin: string | null; dureeMs: number | null; erreur: string | null }
interface EtatTache { tache: string; derniere: Execution | null; dernierSucces: string | null; echecs7j: number }
interface Etat { taches: EtatTache[]; webhooks: { enEchec: number; enAttente: number }; cronConfigure: boolean }

export default function TachesPlanifiees() {
  const { t, locale } = useTranslation()
  const p = t.tachesPlanifiees
  const [etat, setEtat] = useState<Etat | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const charger = useCallback(async () => {
    const r = await fetch('/api/admin/taches')
    if (r.ok) setEtat(await r.json()); else setMessage(apiErrorMessage((await r.json().catch(() => ({}))).error, t, p.erreurChargement))
  }, [t, p.erreurChargement])
  useEffect(() => { void charger() }, [charger])

  async function agir(corps: Record<string, string>, cle: string) {
    setBusy(cle); setMessage(null)
    const r = await fetch('/api/admin/taches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
    const d = await r.json().catch(() => ({}))
    setBusy(null)
    setMessage(r.ok ? (corps.action === 'relancer-webhooks' ? p.webhooksRemis.replace('{n}', String(d.remis ?? 0)) : p.relanceOk) : apiErrorMessage(d.error, t, p.relanceEchec))
    void charger()
  }
  const date = (d: string | null) => (d ? new Date(d).toLocaleString(locale) : '—')
  const nom = (k: string) => (p.noms as Record<string, string>)[k] ?? k
  if (!etat) return <p className="text-sm text-gray-500">{message ?? '…'}</p>
  return (
    <div>
      {!etat.cronConfigure && <p className="mb-2 text-sm text-amber-700 dark:text-amber-300">{p.cronAbsent}</p>}
      {message && <p role="status" className="mb-2 text-sm text-gray-700 dark:text-gray-200">{message}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
              <th className="px-2 py-2">{p.colTache}</th><th className="px-2 py-2">{p.colDerniere}</th><th className="px-2 py-2">{p.colSucces}</th><th className="px-2 py-2">{p.colEchecs}</th><th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {etat.taches.map(x => (
              <tr key={x.tache} className="border-b border-gray-100 dark:border-gray-800 align-top">
                <td className="px-2 py-2 font-medium">{nom(x.tache)}</td>
                <td className="px-2 py-2">
                  {x.derniere ? (
                    <span className={x.derniere.statut === 'ECHEC' ? 'text-red-600 dark:text-red-400' : x.derniere.statut === 'OK' ? 'text-green-700 dark:text-green-400' : ''}>
                      {(p.statuts as Record<string, string>)[x.derniere.statut] ?? x.derniere.statut} · {date(x.derniere.debut)}{x.derniere.declencheur === 'MANUEL' ? ` · ${p.manuel}` : ''}
                      {x.derniere.erreur && <span className="block text-xs text-red-600 dark:text-red-400 break-words">{x.derniere.erreur}</span>}
                    </span>
                  ) : <span className="text-gray-400">{p.jamais}</span>}
                </td>
                <td className="px-2 py-2">{date(x.dernierSucces)}</td>
                <td className={`px-2 py-2 ${x.echecs7j ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>{x.echecs7j}</td>
                <td className="px-2 py-2 text-right">
                  <button type="button" disabled={!!busy || !etat.cronConfigure} onClick={() => agir({ action: 'relancer', tache: x.tache }, x.tache)} className="text-xs px-2 py-1 rounded-sm border border-gray-300 dark:border-gray-600 disabled:opacity-40">
                    {busy === x.tache ? '…' : p.relancer}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span>{p.webhooks.replace('{echec}', String(etat.webhooks.enEchec)).replace('{attente}', String(etat.webhooks.enAttente))}</span>
        {etat.webhooks.enEchec > 0 && (
          <button type="button" disabled={!!busy} onClick={() => agir({ action: 'relancer-webhooks' }, 'webhooks')} className="text-xs px-2 py-1 rounded-sm border border-gray-300 dark:border-gray-600 disabled:opacity-40">{p.relancerWebhooks}</button>
        )}
      </div>
    </div>
  )
}
