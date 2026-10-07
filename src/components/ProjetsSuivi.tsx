'use client'

// ─── Suivi des projets 360 (cockpit GRC /pilotage) ───────────────────────────
// Consolide les analyses PROJET_360 du périmètre : avancement, retard, validation
// RSSI + Risk Manager, risques élevés. Alimenté par /api/grc/rollup (`projets`).

import Link from 'next/link'
import { Briefcase } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import type { ProjetsSynthese } from '@/lib/projet360'

const VALIDATION_STYLE = {
  COMPLETE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  PARTIELLE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  AUCUNE: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
} as const

export default function ProjetsSuivi({ synthese }: { synthese: ProjetsSynthese }) {
  const { t, locale } = useTranslation()
  const p = t.pilotage.projets
  const kpis: [string, number, string][] = [
    [p.total, synthese.total, ''], [p.enCours, synthese.enCours, ''],
    [p.enRetard, synthese.enRetard, synthese.enRetard > 0 ? 'text-red-600 dark:text-red-400' : ''],
    [p.valides, synthese.valides, ''], [p.termines, synthese.termines, ''],
  ]
  return (
    <section className="card p-5" aria-labelledby="pilotage-projets">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 id="pilotage-projets" className="text-base font-semibold text-gray-900 dark:text-gray-100"><Briefcase size={16} className="inline align-[-0.15em] mr-1.5 text-ebios-600" aria-hidden="true" />{p.title}</h2>
        <Link href="/projets" className="text-xs text-ebios-700 hover:underline">{p.voirTous}</Link>
      </div>
      <p className="text-xs text-gray-500 mb-3">{p.subtitle}</p>
      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {kpis.map(([label, n, cls]) => (
          <div key={label}><dt className="text-xs text-gray-500">{label}</dt><dd className={`text-xl font-bold tabular-nums ${cls}`}>{n}</dd></div>
        ))}
      </dl>
      {synthese.projets.length === 0 ? <p className="text-sm italic text-gray-400">{p.empty}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 pr-3">{p.colProjet}</th><th className="py-2 pr-3">{p.colStatut}</th><th className="py-2 pr-3">{p.colRisques}</th>
              <th className="py-2 pr-3">{p.colEleves}</th><th className="py-2 pr-3">{p.colValidation}</th><th className="py-2">{p.colEcheance}</th>
            </tr></thead>
            <tbody>
              {synthese.projets.slice(0, 12).map(pr => (
                <tr key={pr.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-3 font-medium"><Link href={`/analyses/${pr.id}/atelier/1?phase=qualification`} className="text-ebios-700 hover:underline">{pr.nom}</Link></td>
                  <td className="py-2 pr-3 text-xs">{(t.statusLabels as Record<string, string>)[pr.statut] ?? pr.statut}</td>
                  <td className="py-2 pr-3 tabular-nums">{pr.risques}</td>
                  <td className={`py-2 pr-3 tabular-nums ${pr.eleves > 0 ? 'font-semibold text-red-600 dark:text-red-400' : ''}`}>{pr.eleves}</td>
                  <td className="py-2 pr-3"><span className={`inline-block rounded-sm px-1.5 py-0.5 text-xs ${VALIDATION_STYLE[pr.validation]}`}>{p.validations[pr.validation]}</span></td>
                  <td className="py-2 text-xs">
                    {pr.dateEcheance ? new Date(pr.dateEcheance).toLocaleDateString(locale) : '—'}
                    {pr.enRetard && <span className="ml-1.5 rounded-sm bg-red-100 px-1.5 py-0.5 text-red-800 dark:bg-red-900/30 dark:text-red-300">{p.enRetard}</span>}
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
