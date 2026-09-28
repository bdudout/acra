'use client'

// ─── Tableau de bord 360 (phase d'évaluation de l'analyse projet 360) ────────
// Une carte par domaine : nombre de risques, niveau brut et résiduel maximal,
// dépassements de l'appétit (seuil global de l'organisation), part traitée, trois
// principaux risques et avancement du questionnaire. Synthèse : lib/projet360.

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { domainStats360, progression360, type Risque360Lite } from '@/lib/projet360'

export default function Dashboard360({ analyseId, appetitSeuil, answers }: {
  analyseId: string; appetitSeuil: number | null; answers: Record<string, boolean>
}) {
  const { t } = useTranslation()
  const p = t.projet360
  const domaines = p.domaines as Record<string, string>
  const [risques, setRisques] = useState<Risque360Lite[] | null>(null)

  useEffect(() => {
    fetch(`/api/analyses/${analyseId}/risques`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { risques: [] })).then(d => setRisques(Array.isArray(d.risques) ? d.risques : []))
      .catch(() => setRisques([]))
  }, [analyseId])

  const stats = useMemo(() => domainStats360(risques ?? [], appetitSeuil), [risques, appetitSeuil])
  const progression = useMemo(() => progression360(answers), [answers])

  return (
    <section className="card p-6 mb-5">
      <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{p.dashTitle}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">{p.dashIntro}</p>
      {risques === null ? <p className="text-xs text-gray-400">…</p> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stats.domains.map(d => (
              <section key={d.domaine} aria-label={domaines[d.domaine]} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{domaines[d.domaine]}</h3>
                  <span className="text-[11px] text-gray-500">{p.questionnaire} {progression[d.domaine].answered}/{progression[d.domaine].total}</span>
                </div>
                {d.count === 0 ? <p className="mt-3 text-xs italic text-gray-400">{p.noRisk}</p> : (
                  <>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div><dt className="text-gray-500">{p.count}</dt><dd className="text-base font-semibold tabular-nums">{d.count}</dd></div>
                      <div><dt className="text-gray-500">{p.aboveAppetite}</dt><dd className={`text-base font-semibold tabular-nums ${d.aboveAppetite > 0 ? 'text-red-700 dark:text-red-300' : ''}`}>{d.aboveAppetite}</dd></div>
                      <div><dt className="text-gray-500">{p.maxBrut}</dt><dd className="font-semibold tabular-nums">{d.maxBrut}</dd></div>
                      <div><dt className="text-gray-500">{p.maxResiduel}</dt><dd className="font-semibold tabular-nums">{d.maxResiduel}</dd></div>
                      <div className="col-span-2"><dt className="text-gray-500">{p.treated}</dt><dd className="tabular-nums">{d.treated} / {d.count}</dd></div>
                    </dl>
                    <p className="mt-3 text-[11px] uppercase tracking-wide text-gray-500">{p.top}</p>
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {d.top.map(r => (
                        <li key={r.id} className="flex justify-between gap-2"><span className="truncate text-gray-700 dark:text-gray-200">{r.nom}</span><span className="tabular-nums text-gray-500">{r.niveauRisque}</span></li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            ))}
          </div>
          {stats.unclassified > 0 && <p className="mt-3 text-xs text-amber-700">{p.unclassified.replace('{n}', String(stats.unclassified))}</p>}
        </>
      )}
    </section>
  )
}
