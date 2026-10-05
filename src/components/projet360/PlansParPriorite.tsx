'use client'
// ─── Projet 360, phase Traitement : plans d'action par priorité ───────────────
// Les plans qui réduisent les risques les plus élevés d'abord (ordre calculé côté serveur : lib/plans-priorite).

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

interface Plan {
  id: string; titre: string; statut: string; priorite: string; echeance: string | null; porteur: string | null
  risques: { id: string; nom: string; niveau: number }[]; niveauMax: number; enRetard: boolean
}

export default function PlansParPriorite({ analyseId, reloadKey = 0 }: { analyseId: string; reloadKey?: number }) {
  const { t, locale } = useTranslation()
  const p = t.projet360.plansPriorite
  const rd = t.risquesDirects
  const [plans, setPlans] = useState<Plan[] | null>(null)
  useEffect(() => {
    fetch(`/api/analyses/${analyseId}/plans-projet`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => setPlans(Array.isArray(d?.plans) ? d.plans : [])).catch(() => setPlans([]))
  }, [analyseId, reloadKey])
  if (plans === null) return null
  const th = 'px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400'
  return (
    <section className="card p-5 mb-5" aria-label={p.title}>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{p.title}</h2>
      <p className="mt-1 mb-3 text-sm text-gray-500 dark:text-gray-400">{p.intro}</p>
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
                    {pl.risques.map(r => <span key={r.id} className="block">{r.nom} <span className="tabular-nums text-gray-400">· {r.niveau}</span></span>)}
                  </td>
                  <td className="px-3 py-2 text-xs">{(rd.plansPriorites as Record<string, string>)[pl.priorite] ?? pl.priorite}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {pl.echeance ? new Date(pl.echeance).toLocaleDateString(locale) : '—'}
                    {pl.enRetard && <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-500/20 dark:text-red-300">{p.enRetard}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">{(rd.plansStatuts as Record<string, string>)[pl.statut] ?? pl.statut}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{pl.porteur ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
