'use client'

// ─── Portefeuille des projets 360 : carte de chaleur domaine × projet ────────────────────────────────────────────────
// Chaque cellule indique « nombre de risques · niveau le plus élevé » (résiduel s'il est coté, sinon brut) ; en rouge quand
// au moins un risque dépasse l'appétit. Export Excel. Lecture seule : l'édition se fait dans chaque projet.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'
import { DOMAINES_360 } from '@/lib/projet360'
import type { Portefeuille360 } from '@/lib/projet360-portefeuille'

export default function ProjetsPortefeuille() {
  const { t, locale } = useTranslation()
  const p = t.projets.portefeuille
  const [data, setData] = useState<Portefeuille360 | null>(null)
  useEffect(() => { fetch('/api/projets/portefeuille').then(r => (r.ok ? r.json() : null)).then(setData).catch(() => {}) }, [])
  if (!data || data.projets.length === 0) return null
  const dom = t.projet360.domaines as Record<string, string>
  return (
    <section className="card p-5 mb-6" aria-label={p.title}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{p.title}</h2>
        <a href={`/api/projets/portefeuille?format=xlsx&lang=${locale}`} className="btn-secondary text-xs">{p.export}</a>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{data.appetit != null ? p.hintAppetit.replace('{n}', String(data.appetit)) : p.hintNoAppetit}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label={p.title}>
          <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 pr-3">{p.project}</th>
            {DOMAINES_360.map(d => <th key={d} className="py-2 px-2 text-center">{dom[d]}</th>)}
            <th className="py-2 px-2 text-center">{p.above}</th>
          </tr></thead>
          <tbody>
            {data.projetsTries.map(l => (
              <tr key={l.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 pr-3"><Link href={`/analyses/${l.id}`} className="text-ebios-700 hover:underline">{l.nom}</Link> <span className="text-[10px] text-gray-400">{l.statut}</span></td>
                {DOMAINES_360.map(d => {
                  const c = l.parDomaine[d]
                  return <td key={d} className="py-2 px-2 text-center tabular-nums">{c.count ? <span className={c.auDessusAppetit > 0 ? 'rounded px-1.5 py-0.5 bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200 font-medium' : 'rounded px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700'}>{`${c.count} · ${c.maxEffectif}`}</span> : <span className="text-gray-300">—</span>}</td>
                })}
                <td className="py-2 px-2 text-center tabular-nums">{l.auDessusAppetit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
