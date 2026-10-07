'use client'
// ─── Projet 360, phase Traitement : plans d'action par priorité ───────────────
// Les plans qui réduisent les risques les plus élevés d'abord (ordre calculé côté serveur : lib/plans-priorite).
// Éditable (chef de projet) : porteur, échéance et statut, enregistrés sur le plan via son risque
// (PATCH /api/analyses/[id]/risques/[riskId]/plans/[planId]) ; plan prévu après la mise en service signalé. Risques
// visés repérés par leur référence R1, R2… (lib/risque-refs, même numérotation que la matrice) ; priorité en couleur.

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { ACTION_PRIORITE_BADGE, RISK_ACTION_STATUTS } from '@/lib/risk-action'

interface Plan {
  id: string; titre: string; statut: string; priorite: string; echeance: string | null; porteur: string | null
  risques: { id: string; ref?: string; nom: string; niveau: number }[]; niveauMax: number; enRetard: boolean
}

const field = 'rounded-sm border border-gray-300 bg-white px-1.5 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800'

export default function PlansParPriorite({ analyseId, reloadKey = 0, editable = false, miseEnService = null }: {
  analyseId: string; reloadKey?: number; editable?: boolean
  /** Date de mise en service du projet (AAAA-MM-JJ) : un plan prévu après elle est signalé. */
  miseEnService?: string | null
}) {
  const { t, locale } = useTranslation()
  const p = t.projet360.plansPriorite
  const rd = t.risquesDirects
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [erreur, setErreur] = useState(false)
  const limite = miseEnService ? new Date(`${miseEnService}T23:59:59`).getTime() : null
  async function maj(pl: Plan, patch: Partial<Pick<Plan, 'porteur' | 'echeance' | 'statut'>>) {
    const risque = pl.risques[0]
    if (!risque) return
    setErreur(false)
    const res = await fetch(`/api/analyses/${analyseId}/risques/${risque.id}/plans/${pl.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }).catch(() => null)
    if (!res?.ok) { setErreur(true); return }
    const d = await res.json()
    setPlans(l => (l ?? []).map(x => (x.id === pl.id ? { ...x, ...d.plan, enRetard: x.enRetard && (d.plan?.statut ?? x.statut) !== 'FAIT' } : x)))
  }
  useEffect(() => {
    fetch(`/api/analyses/${analyseId}/plans-projet`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => setPlans(Array.isArray(d?.plans) ? d.plans : [])).catch(() => setPlans([]))
  }, [analyseId, reloadKey])
  if (plans === null) return null
  const th = 'px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400'
  return (
    <section className="card p-5 mb-5" aria-label={p.title}>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{p.title}</h2>
      <p className="mt-1 mb-3 text-sm text-gray-500 dark:text-gray-400">{p.intro}</p>
      {erreur && <p role="alert" className="mb-2 text-xs text-red-600">{p.erreurMaj}</p>}
      {plans.length === 0 ? <p className="text-sm italic text-gray-400">{p.aucun}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 dark:border-gray-700">
              <th className={th}>#</th><th className={th}>{p.colPlan}</th><th className={th}>{p.colRisques}</th>
              <th className={th}>{p.colPriorite}</th><th className={th}>{p.colEcheance}</th><th className={th}>{p.colStatut}</th><th className={th}>{p.colPorteur}</th>
            </tr></thead>
            <tbody>
              {plans.map((pl, i) => (
                <tr key={pl.id} className={`border-b border-gray-100 dark:border-gray-800 ${pl.statut === 'FAIT' ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-2 tabular-nums text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">{pl.titre}</td>
                  <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                    {pl.risques.map(r => (
                      <span key={r.id} className="block">
                        {r.ref && <span className="mr-1 font-mono font-semibold text-ebios-700 dark:text-ebios-300">{r.ref}</span>}
                        {r.nom} <span className="tabular-nums text-gray-400">· {r.niveau}</span>
                      </span>
                    ))}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 font-medium ${ACTION_PRIORITE_BADGE[pl.priorite] ?? 'bg-gray-100 text-gray-600'}`}>{(rd.plansPriorites as Record<string, string>)[pl.priorite] ?? pl.priorite}</span>
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {editable
                      ? <input type="date" aria-label={`${p.modifEcheance} — ${pl.titre}`} defaultValue={pl.echeance ? pl.echeance.slice(0, 10) : ''} onChange={e => maj(pl, { echeance: e.target.value || null })} className={field} />
                      : pl.echeance ? new Date(pl.echeance).toLocaleDateString(locale) : '—'}
                    {pl.enRetard && <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-500/20 dark:text-red-300">{p.enRetard}</span>}
                    {limite != null && pl.statut !== 'FAIT' && pl.echeance && new Date(pl.echeance).getTime() > limite && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">{p.apresMes}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {editable
                      ? <select aria-label={`${p.modifStatut} — ${pl.titre}`} value={pl.statut} onChange={e => maj(pl, { statut: e.target.value })} className={field}>
                          {RISK_ACTION_STATUTS.map(s => <option key={s} value={s}>{(rd.plansStatuts as Record<string, string>)[s] ?? s}</option>)}
                        </select>
                      : (rd.plansStatuts as Record<string, string>)[pl.statut] ?? pl.statut}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                    {editable
                      ? <input aria-label={`${p.modifPorteur} — ${pl.titre}`} defaultValue={pl.porteur ?? ''} maxLength={120}
                          onBlur={e => { const v = e.target.value.trim(); if (v !== (pl.porteur ?? '')) maj(pl, { porteur: v || null }) }} className={`${field} w-32`} />
                      : pl.porteur ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
