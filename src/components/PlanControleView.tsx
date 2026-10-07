'use client'

// ─── Plan annuel des contrôles ───────────────────────────────────────────────
// Une occurrence par période et par contrôle actif (lib/controle-l3.planAnnuel) :
// pastilles réalisée / en retard / en cours / à venir, synthèse, charge par responsable
// et par mois avec pics signalés.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarRange } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import type { PlanAnnuel } from '@/lib/controle-l3'

interface Data { active: boolean; annee: number; plan: PlanAnnuel; controles: { id: string; intitule: string; periodicite: string; responsable: string | null; niveau: string; cle: boolean; modeControle: string }[] }
const DOT: Record<string, string> = {
  REALISEE: 'bg-green-500', EN_RETARD: 'bg-red-500', EN_COURS: 'bg-amber-400', A_VENIR: 'bg-gray-300 dark:bg-gray-600',
}

export default function PlanControleView() {
  const { t, locale } = useTranslation()
  const p = t.controles.plan
  const st = p.st as Record<string, string>
  const [annee, setAnnee] = useState<number | null>(null)
  const [data, setData] = useState<Data | null>(null)

  useEffect(() => {
    fetch(`/api/controles/plan${annee ? `?annee=${annee}` : ''}`).then(r => (r.ok ? r.json() : null)).then(setData).catch(() => setData(null))
  }, [annee])

  if (!data || !data.active) return <p className="text-sm text-gray-400">…</p>
  const s = data.plan.synthese
  const ctl = new Map(data.controles.map(c => [c.id, c]))
  const mois = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2000, i, 1)).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }))
  const annees = [data.annee - 1, data.annee, data.annee + 1]
  const kpis: [string, string | number][] = [[p.prevues, s.prevues], [p.echues, s.echues], [p.realisees, s.realisees], [p.enRetard, s.enRetard], [p.taux, s.tauxRealisation == null ? '—' : `${s.tauxRealisation} %`]]

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100"><CalendarRange size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" />{p.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{p.subtitle}</p>
        </div>
        <div className="flex items-end gap-3">
          <label className="text-xs text-gray-500">{p.annee}
            <select aria-label={p.annee} value={data.annee} onChange={e => setAnnee(Number(e.target.value))} className="block mt-1 px-2 py-1.5 rounded-sm border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm">
              {annees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <Link href="/controles" className="text-xs text-ebios-700 hover:underline">{p.retour}</Link>
        </div>
      </header>

      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {kpis.map(([l, v]) => <div key={l} className="card p-3"><dt className="text-xs text-gray-500">{l}</dt><dd className="text-xl font-bold tabular-nums text-gray-800 dark:text-gray-100">{v}</dd></div>)}
      </dl>

      <div className="card overflow-x-auto">
        {data.plan.lignes.length === 0 ? <p className="p-5 text-sm italic text-gray-400">{p.vide}</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-2">{p.colControle}</th><th className="px-4 py-2">{p.colNiveau}</th><th className="px-4 py-2">{p.colResp}</th><th className="px-4 py-2">{p.synthese}</th>
            </tr></thead>
            <tbody>
              {data.plan.lignes.map(l => {
                const c = ctl.get(l.controleId)
                return (
                  <tr key={l.controleId} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-100">{c?.intitule ?? l.controleId}{c?.cle && <span className="ml-1.5 rounded-full bg-indigo-100 dark:bg-indigo-500/15 px-1.5 py-px text-[10px] text-indigo-800 dark:text-indigo-300">{t.controles.ctl_cle}</span>}</td>
                    <td className="px-4 py-2 text-xs">{c?.niveau}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{c?.responsable ?? '—'}</td>
                    <td className="px-4 py-2"><span className="flex flex-wrap gap-1">
                      {l.occurrences.map(o => <span key={o.index} role="img" aria-label={`${o.debut} → ${o.fin} : ${st[o.statut]}`} title={`${o.debut} → ${o.fin} : ${st[o.statut]}`} className={`inline-block h-3 w-3 rounded-full ${DOT[o.statut]}`} />)}
                    </span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <ul className="flex flex-wrap gap-4 text-xs text-gray-500">{Object.entries(st).map(([k, v]) => <li key={k} className="flex items-center gap-1.5"><span className={`inline-block h-3 w-3 rounded-full ${DOT[k]}`} aria-hidden="true" />{v}</li>)}</ul>

      <section className="card overflow-x-auto">
        <h2 className="px-4 pt-3 text-sm font-semibold text-gray-800 dark:text-gray-100">{p.charge}</h2>
        <table aria-label={p.charge} className="w-full text-xs mt-2">
          <thead><tr className="text-left uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700"><th className="px-4 py-2">{p.colResp}</th>{mois.map(m => <th key={m} className="px-2 py-2 text-right">{m}</th>)}</tr></thead>
          <tbody>
            {data.plan.charge.map(c => (
              <tr key={c.responsable} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-4 py-1.5 font-medium">{c.responsable || '—'}</td>
                {c.parMois.map((n, i) => c.pics.includes(i)
                  ? <td key={i} aria-label={`${p.pic} : ${mois[i]}`} className="px-2 py-1.5 text-right tabular-nums font-bold text-red-600 dark:text-red-400">{n}</td>
                  : <td key={i} className="px-2 py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{n || ''}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
