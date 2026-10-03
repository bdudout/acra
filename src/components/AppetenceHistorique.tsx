'use client'

// ─── Historique d'appétence : instantanés mensuels et tendance ───────────────────────────────────────────────────────
// Résumés d'agrégats figés chaque mois (cron + action manuelle) ; la tendance compare chaque mois au précédent.
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import type { Tendance } from '@/lib/appetit-historique'

export default function AppetenceHistorique() {
  const { t, locale } = useTranslation()
  const h = t.appetence.historique
  const [data, setData] = useState<{ canWrite: boolean; tendances: Tendance[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const load = useCallback(() => { fetch('/api/appetence/historique').then(r => (r.ok ? r.json() : null)).then(setData).catch(() => {}) }, [])
  useEffect(() => { load() }, [load])
  async function figer() {
    setBusy(true); setMsg(null)
    const res = await fetch('/api/appetence/historique', { method: 'POST' }).catch(() => null)
    setBusy(false)
    if (res?.ok) { setMsg(h.saved); load() } else setMsg(h.failed)
  }
  if (!data) return null
  const sens = h.sens as Record<string, string>
  const voyants = t.appetence.voyants as Record<string, string>
  const lignes = [...data.tendances].reverse()
  return (
    <section className="card p-5" aria-labelledby="appetence-historique">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="appetence-historique" className="text-base font-semibold text-gray-800 dark:text-gray-100">{h.title}</h2>
        <div className="flex items-center gap-3">
          {lignes.length > 0 && <a href={`/api/appetence/historique?format=xlsx&lang=${locale}`} className="text-xs text-ebios-700 hover:underline">{h.export}</a>}
          {data.canWrite && <button type="button" disabled={busy} onClick={figer} className="btn-secondary text-xs">{h.capture}</button>}
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{h.hint}</p>
      {msg && <p role="status" className="text-xs mt-2 text-gray-600 dark:text-gray-300">{msg}</p>}
      {lignes.length === 0 ? <p className="text-sm italic text-gray-400 mt-3">{h.empty}</p> : (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm" aria-label={h.title}>
            <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2 pr-3">{h.periode}</th><th className="py-2 px-2">{h.globalLabel}</th><th className="py-2 px-2 text-right">{h.hors}</th><th className="py-2 px-2 text-right">{h.kri}</th><th className="py-2 px-2 text-right">{h.maturite}</th><th className="py-2 pl-2">{h.sensCol}</th>
            </tr></thead>
            <tbody>
              {lignes.map(x => (
                <tr key={x.periode} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-3 tabular-nums">{x.periode}</td>
                  <td className="py-2 px-2">{voyants[x.resume.global] ?? x.resume.global}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{x.resume.appetit ? `${x.resume.appetit.horsAppetit}/${x.resume.appetit.evalues}` : '—'}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{x.resume.kri ? x.resume.kri.alerte + x.resume.kri.critique : '—'}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{x.resume.maturite.length ? x.resume.maturite.reduce((n, m) => n + m.belowTarget, 0) : '—'}</td>
                  <td className="py-2 pl-2">{x.sens ? <span className={x.sens === 'DEGRADATION' ? 'text-red-700 dark:text-red-300' : x.sens === 'AMELIORATION' ? 'text-green-700 dark:text-green-300' : 'text-gray-500'}>{x.sens === 'AMELIORATION' ? '↗ ' : x.sens === 'DEGRADATION' ? '↘ ' : '→ '}{sens[x.sens]}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
