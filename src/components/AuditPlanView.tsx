'use client'

// ─── Univers d'audit et plan pluriannuel ─────────────────────────────────────
// Entités auditables cotées par risque ; couverture par les missions (dernière mission,
// cycle, prochaine échéance) et plan par année (lib/audit-l4.planPluriannuel).

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Layers } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import AuditConfigEditor from '@/components/AuditConfigEditor'
import { UNIVERS_TYPES, type PlanPluriannuel } from '@/lib/audit-l4'

interface UniversRow { id: string; intitule: string; type: string; risque: number; cycleAns: number | null; commentaire: string | null; actif: boolean }
const STATUT_BADGE: Record<string, string> = {
  A_JOUR: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  PLANIFIE: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  A_PLANIFIER: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  EN_RETARD: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  JAMAIS_AUDITE: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
}
const inp = 'px-2 py-1.5 rounded-sm border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'

export default function AuditPlanView() {
  const { t } = useTranslation()
  const l = t.auditInterne.l4
  const couv = t.rapports.couvertures as Record<string, string>
  const types = l.universTypes as Record<string, string>
  const [data, setData] = useState<{ plan: PlanPluriannuel; univers: UniversRow[]; canWrite?: boolean } | null>(null)
  const [horizon, setHorizon] = useState(3)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ intitule: '', type: 'PROCESSUS', risque: '2', cycleAns: '' })
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    Promise.all([fetch(`/api/audit/plan?horizon=${horizon}`).then(r => (r.ok ? r.json() : null)), fetch('/api/audit/univers').then(r => (r.ok ? r.json() : null))])
      .then(([p, u]) => { if (p?.active) setData({ plan: p.plan, univers: p.univers, canWrite: !!u?.canWrite }) })
      .catch(() => setData(null))
  }, [horizon])
  useEffect(() => { load() }, [load])

  async function ajouter() {
    setError(null)
    const res = await fetch('/api/audit/univers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intitule: form.intitule, type: form.type, risque: Number(form.risque), ...(form.cycleAns ? { cycleAns: Number(form.cycleAns) } : {}) }) }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    if (!res || !res.ok) { setError((l.errors as Record<string, string>)[d?.error] ?? String(d?.error ?? res?.status ?? '—')); return }
    setAdding(false); setForm({ intitule: '', type: 'PROCESSUS', risque: '2', cycleAns: '' }); load()
  }
  async function supprimer(id: string) {
    if (!confirm(l.supprimerConfirm)) return
    await fetch(`/api/audit/univers/${id}`, { method: 'DELETE' }); load()
  }

  if (!data) return <p className="text-sm text-gray-400">…</p>
  const s = data.plan.synthese
  const parId = new Map(data.univers.map(u => [u.id, u]))
  const day = (v: string | null) => v ?? '—'
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100"><Layers size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" />{l.planTitle}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{l.planSubtitle}</p>
        </div>
        <div className="flex items-end gap-3">
          <label className="text-xs text-gray-500">{l.horizon}
            <select aria-label={l.horizon} value={horizon} onChange={e => setHorizon(Number(e.target.value))} className={`${inp} block mt-1`}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select>
          </label>
          <Link href="/audit" className="text-xs text-ebios-700 hover:underline">{l.retour}</Link>
        </div>
      </header>

      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {([[l.couverture, s.couverturePct == null ? '—' : `${s.couverturePct} %`], [couv.A_JOUR, s.aJour], [couv.A_PLANIFIER, s.aPlanifier], [couv.EN_RETARD, s.enRetard], [couv.JAMAIS_AUDITE, s.jamais]] as [string, string | number][]).map(([k, v]) => (
          <div key={k} className="card p-3"><dt className="text-xs text-gray-500">{k}</dt><dd className="text-xl font-bold tabular-nums text-gray-800 dark:text-gray-100">{v}</dd></div>
        ))}
      </dl>

      {data.canWrite && !adding && <button type="button" onClick={() => setAdding(true)} className="btn-primary text-sm">{l.universAdd}</button>}
      {adding && (
        <section className="card p-4 space-y-3" aria-label={l.universAdd}>
          <div className="flex flex-wrap gap-3">
            <label className="text-xs text-gray-500">{l.universIntitule}<input aria-label={l.universIntitule} value={form.intitule} maxLength={200} onChange={e => setForm(f => ({ ...f, intitule: e.target.value }))} className={`${inp} block mt-1 w-64`} /></label>
            <label className="text-xs text-gray-500">{l.universType}
              <select aria-label={l.universType} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={`${inp} block mt-1`}>{UNIVERS_TYPES.map(x => <option key={x} value={x}>{types[x]}</option>)}</select>
            </label>
            <label className="text-xs text-gray-500">{l.universRisque}
              <select aria-label={l.universRisque} value={form.risque} onChange={e => setForm(f => ({ ...f, risque: e.target.value }))} className={`${inp} block mt-1`}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select>
            </label>
            <label className="text-xs text-gray-500">{l.universCycle}<input type="number" min="1" max="10" aria-label={l.universCycle} value={form.cycleAns} onChange={e => setForm(f => ({ ...f, cycleAns: e.target.value }))} className={`${inp} block mt-1 w-28`} /></label>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={!form.intitule.trim()} onClick={ajouter} className="btn-primary text-sm disabled:opacity-50">{t.auditInterne.add}</button>
            <button type="button" onClick={() => setAdding(false)} className="text-sm text-gray-500 hover:underline">{t.auditInterne.cancel}</button>
            {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
          </div>
        </section>
      )}

      <div className="card overflow-x-auto">
        {data.plan.entrees.length === 0 ? <p className="p-5 text-sm italic text-gray-400">{l.vide}</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-2">{l.colUnivers}</th><th className="px-4 py-2">{l.colRisque}</th><th className="px-4 py-2">{l.colCycle}</th><th className="px-4 py-2">{l.colDerniere}</th><th className="px-4 py-2">{l.colProchaine}</th><th className="px-4 py-2">{l.colStatut}</th><th className="px-4 py-2" />
            </tr></thead>
            <tbody>
              {data.plan.entrees.map(e => {
                const u = parId.get(e.universId)
                return (
                  <tr key={e.universId} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-100">{u?.intitule}<span className="block text-xs text-gray-400">{u ? types[u.type] : ''}</span></td>
                    <td className="px-4 py-2 tabular-nums">{u?.risque}</td>
                    <td className="px-4 py-2 tabular-nums">{e.cycleAns}</td>
                    <td className="px-4 py-2 text-xs tabular-nums">{day(e.derniere)}</td>
                    <td className="px-4 py-2 text-xs tabular-nums">{day(e.prochaine)}{e.planifiee && <span className="block text-blue-700 dark:text-blue-300">→ {e.planifiee}</span>}</td>
                    <td className="px-4 py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUT_BADGE[e.statut]}`}>{couv[e.statut]}</span></td>
                    <td className="px-4 py-2 text-right">{data.canWrite && <button type="button" onClick={() => supprimer(e.universId)} className="text-xs text-red-500 hover:underline">{t.auditInterne.delete}</button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <section className="card p-4">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{l.planParAnnee}</h2>
        <ul className="mt-2 grid gap-3 sm:grid-cols-3">
          {data.plan.parAnnee.map(a => (
            <li key={a.annee}>
              <p className="text-xs font-semibold text-gray-500">{a.annee} <span className="tabular-nums">({a.universIds.length})</span></p>
              <ul className="text-xs text-gray-700 dark:text-gray-200">{a.universIds.map(id => <li key={id}>{parId.get(id)?.intitule ?? id}</li>)}</ul>
            </li>
          ))}
        </ul>
      </section>
      <AuditConfigEditor onSaved={load} />
    </div>
  )
}
