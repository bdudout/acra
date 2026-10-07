'use client'

// ─── Programme de tests de résilience opérationnelle numérique (DORA) ────────
// Année du programme, indicateurs (réalisation, fonctions critiques ou importantes,
// constats, indépendance, échéance TLPT), liste des tests et formulaire (type
// officiel art. 25 / TLPT art. 26, périmètre, testeur, statut, dates, résultat,
// constats, risques du registre liés). Export du rapport de réexamen (art. 6 § 5).

import { useEffect, useState } from 'react'
import ExampleChips from '@/components/ExampleChips'
import ModuleGuide from '@/components/ModuleGuide'
import { useTranslation } from '@/lib/i18n/context'
import { TEST_RESILIENCE_TYPES, TEST_RESILIENCE_STATUTS, TESTEURS, type Constat } from '@/lib/tests-resilience'

interface TestRow {
  id: string; annee: number; intitule: string; type: string; statut: string; fonctionCritique: boolean; independant: boolean
  testeur: string; perimetre: string | null; processusId: string | null; riskItemIds: unknown; datePrevue: string | null
  dateRealisation: string | null; resultat: string | null; constats: unknown
}
interface Stats {
  planifies: number; realises: number; tauxRealisation: number; fonctionsCritiquesTestees: number; nonIndependants: number
  constats: { total: number; ouverts: number; corriges: number; ouvertsCritiques: number }
  tlpt: { dernier: string | null; echeance: string | null; enRetard: boolean }
}
interface Form {
  id?: string; intitule: string; type: string; perimetre: string; fonctionCritique: boolean; testeur: string; independant: boolean
  statut: string; datePrevue: string; dateRealisation: string; resultat: string; constats: Constat[]; riskItemIds: string[]
}
const EMPTY: Form = { intitule: '', type: 'VULNERABILITY', perimetre: '', fonctionCritique: false, testeur: 'INTERNE', independant: true, statut: 'PLANIFIE', datePrevue: '', dateRealisation: '', resultat: '', constats: [], riskItemIds: [] }
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '')
const asConstats = (v: unknown): Constat[] => (Array.isArray(v) ? (v as Constat[]) : [])
const asIds = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : [])
const input = 'mt-1 block w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600'

export default function TestsResilienceManager() {
  const { t, locale } = useTranslation()
  const r = t.testsResilience
  const types = r.types as Record<string, string>
  const statuts = r.statuts as Record<string, string>
  const testeurs = r.testeurs as Record<string, string>
  const [annee, setAnnee] = useState<number | null>(null)
  const [data, setData] = useState<{ annee: number; annees: number[]; canWrite: boolean; tests: TestRow[]; stats: Stats; actionsParConstat?: Record<string, Record<number, { ouvertes: number; faites: number }>> } | null>(null)
  const [risks, setRisks] = useState<{ id: string; intitule: string }[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<Record<string, string>>({})
  const [actionBusy, setActionBusy] = useState<string | null>(null)

  async function load(a: number | null) {
    const d = await fetch(`/api/tests-resilience${a ? `?annee=${a}` : ''}`, { cache: 'no-store' }).then(x => (x.ok ? x.json() : null)).catch(() => null)
    if (d) { setData(d); setAnnee(d.annee) }
  }
  useEffect(() => {
    load(null)
    fetch('/api/risk-items', { cache: 'no-store' }).then(x => (x.ok ? x.json() : null)).then(d => setRisks(Array.isArray(d?.risks) ? d.risks.map((x: { id: string; intitule: string }) => ({ id: x.id, intitule: x.intitule })) : [])).catch(() => {})
  }, [])

  function edit(row: TestRow) {
    setMsg(null)
    setForm({
      id: row.id, intitule: row.intitule, type: row.type, perimetre: row.perimetre ?? '', fonctionCritique: row.fonctionCritique,
      testeur: row.testeur, independant: row.independant, statut: row.statut, datePrevue: day(row.datePrevue), dateRealisation: day(row.dateRealisation),
      resultat: row.resultat ?? '', constats: asConstats(row.constats), riskItemIds: asIds(row.riskItemIds),
    })
  }

  async function save() {
    if (!form || !data) return
    setBusy(true); setMsg(null)
    const { id, ...body } = form
    const res = await fetch(id ? `/api/tests-resilience/${id}` : '/api/tests-resilience', {
      method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, annee: data.annee }),
    }).catch(() => null)
    setBusy(false)
    if (!res || !res.ok) { const d = await res?.json().catch(() => ({})); setMsg(r.error.replace('{error}', String(d?.error ?? res?.status ?? '—'))); return }
    setForm(null)
    await load(data.annee)
  }

  async function remove(id: string) {
    if (!window.confirm(r.deleteConfirm)) return
    await fetch(`/api/tests-resilience/${id}`, { method: 'DELETE' }).catch(() => null)
    await load(annee)
  }

  async function closeFinding(testId: string, constatIndex: number) {
    const key = `${testId}:${constatIndex}`
    setActionBusy(key)
    const res = await fetch(`/api/tests-resilience/${testId}/actions`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ constatIndex, corrige: true }) }).catch(() => null)
    setActionBusy(null)
    if (res?.ok) await load(data?.annee ?? null)
  }

  async function promoteFinding(testId: string, constatIndex: number) {
    const key = `${testId}:${constatIndex}`
    setActionBusy(key); setActionMsg(prev => ({ ...prev, [key]: '' }))
    try {
      const res = await fetch(`/api/tests-resilience/${testId}/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ constatIndex }) })
      const data = await res.json().catch(() => ({}))
      setActionMsg(prev => ({ ...prev, [key]: res.ok ? (data.existing ? r.actionExists : r.actionCreated) : r.actionError.replace('{error}', String(data.error ?? res.status)) }))
    } catch { setActionMsg(prev => ({ ...prev, [key]: r.actionError.replace('{error}', '—') })) }
    finally { setActionBusy(null) }
  }

  // Lien profond depuis le plan d'action unifié (?test=<id>) : la ligne du test est mise en évidence.
  const focusId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('test') : null
  useEffect(() => { if (data && focusId) document.getElementById(`test-${focusId}`)?.scrollIntoView?.({ block: 'center' }) }, [data, focusId])

  if (!data) return <p className="text-sm text-gray-400">…</p>
  const s = data.stats
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale)
  const tlpt = s.tlpt.dernier
    ? `${fmt(s.tlpt.dernier)} · ${(s.tlpt.enRetard ? r.tlptRetard : r.tlptEcheance).replace('{date}', fmt(s.tlpt.echeance!))}`
    : r.tlptNone
  const tiles = [
    { label: r.statRealisation, value: `${s.tauxRealisation} %`, sub: `${s.realises}/${s.planifies}` },
    { label: r.statFonctions, value: String(s.fonctionsCritiquesTestees), sub: '' },
    { label: r.statConstats, value: String(s.constats.ouverts), sub: s.constats.ouvertsCritiques ? r.statCritiques.replace('{n}', String(s.constats.ouvertsCritiques)) : '' },
    { label: r.statNonIndep, value: String(s.nonIndependants), sub: '' },
    { label: r.statTlpt, value: tlpt, sub: '' },
  ]

  return (
    <div className="space-y-6">
      <ModuleGuide guide={r.guide} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-xs text-gray-600 dark:text-gray-300">{r.annee}
          <select aria-label={r.annee} value={data.annee} onChange={e => load(Number(e.target.value))} className={input}>
            {[...new Set([...data.annees, data.annee + 1])].sort((a, b) => b - a).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          {data.canWrite && <button type="button" onClick={() => { setMsg(null); setForm({ ...EMPTY }) }} className="btn-primary text-sm">{r.add}</button>}
        </div>
      </div>

      <dl className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {tiles.map(tile => (
          <div key={tile.label} className="card px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">{tile.label}</dt>
            <dd className="text-base font-semibold tabular-nums">{tile.value}</dd>
            {tile.sub && <dd className="text-xs text-gray-500">{tile.sub}</dd>}
          </div>
        ))}
      </dl>

      {form && (
        <section className="card p-5 space-y-3" aria-label={form.id ? r.edit : r.add}>
          <div className="grid gap-3 md:grid-cols-2">
            {!form.id && <div className="md:col-span-2"><ExampleChips items={r.examples.map((e, i) => ({ id: String(i), label: e.intitule }))}
              onPick={id => { const e = r.examples[Number(id)]; if (e) setForm(f => f && ({ ...f, intitule: e.intitule, type: e.type, perimetre: e.perimetre, fonctionCritique: e.fonctionCritique, testeur: e.testeur })) }} /></div>}
            <label className="text-xs text-gray-600 dark:text-gray-300">{r.intitule}<input aria-label={r.intitule} value={form.intitule} maxLength={300} onChange={e => setForm({ ...form, intitule: e.target.value })} className={input} /></label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{r.type}
              <select aria-label={r.type} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={input}>
                {TEST_RESILIENCE_TYPES.map(ty => <option key={ty} value={ty}>{types[ty]}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300 md:col-span-2">{r.perimetre}<input aria-label={r.perimetre} value={form.perimetre} onChange={e => setForm({ ...form, perimetre: e.target.value })} className={input} /></label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{r.testeur}
              <select aria-label={r.testeur} value={form.testeur} onChange={e => setForm({ ...form, testeur: e.target.value })} className={input}>
                {TESTEURS.map(x => <option key={x} value={x}>{testeurs[x]}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{r.statut}
              <select aria-label={r.statut} value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })} className={input}>
                {TEST_RESILIENCE_STATUTS.map(x => <option key={x} value={x}>{statuts[x]}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{r.datePrevue}<input type="date" aria-label={r.datePrevue} value={form.datePrevue} onChange={e => setForm({ ...form, datePrevue: e.target.value })} className={input} /></label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{r.dateRealisation}<input type="date" aria-label={r.dateRealisation} value={form.dateRealisation} onChange={e => setForm({ ...form, dateRealisation: e.target.value })} className={input} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.fonctionCritique} onChange={e => setForm({ ...form, fonctionCritique: e.target.checked })} />{r.fonctionCritique}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.independant} onChange={e => setForm({ ...form, independant: e.target.checked })} />{r.independant}</label>
            <label className="text-xs text-gray-600 dark:text-gray-300 md:col-span-2">{r.resultat}<textarea aria-label={r.resultat} value={form.resultat} rows={2} onChange={e => setForm({ ...form, resultat: e.target.value })} className={input} /></label>
          </div>

          <fieldset>
            <legend className="text-xs font-semibold text-gray-700 dark:text-gray-200">{r.constats}</legend>
            <ul className="mt-2 space-y-2">
              {form.constats.map((c, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <input aria-label={r.constatDesc} value={c.description} onChange={e => setForm({ ...form, constats: form.constats.map((x, j) => j === i ? { ...x, description: e.target.value } : x) })} className="flex-1 min-w-48 rounded-sm border border-gray-300 px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600" />
                  <select aria-label={r.severite} value={c.severite} onChange={e => setForm({ ...form, constats: form.constats.map((x, j) => j === i ? { ...x, severite: Number(e.target.value) } : x) })} className="rounded-sm border border-gray-300 px-1 py-1 text-sm dark:bg-gray-800 dark:border-gray-600">
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={c.corrige} onChange={e => setForm({ ...form, constats: form.constats.map((x, j) => j === i ? { ...x, corrige: e.target.checked } : x) })} />{r.corrige}</label>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setForm({ ...form, constats: [...form.constats, { description: '', severite: 2, corrige: false }] })} className="mt-2 text-xs text-ebios-700 hover:underline">{r.addConstat}</button>
          </fieldset>

          {risks.length > 0 && (
            <fieldset>
              <legend className="text-xs font-semibold text-gray-700 dark:text-gray-200">{r.risques}</legend>
              <div className="mt-1 max-h-40 overflow-y-auto grid gap-1 sm:grid-cols-2">
                {risks.map(k => (
                  <label key={k.id} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={form.riskItemIds.includes(k.id)}
                      onChange={e => setForm({ ...form, riskItemIds: e.target.checked ? [...form.riskItemIds, k.id] : form.riskItemIds.filter(x => x !== k.id) })} />
                    {k.intitule}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex items-center gap-2">
            <button type="button" disabled={busy || !form.intitule.trim()} onClick={save} className="btn-primary text-sm disabled:opacity-50">{r.save}</button>
            <button type="button" onClick={() => setForm(null)} className="btn-secondary text-sm">{r.cancel}</button>
            {msg && <span role="status" className="text-xs text-red-700">{msg}</span>}
          </div>
        </section>
      )}

      <div className="card overflow-x-auto">
        {data.tests.length === 0 ? <p className="p-5 text-sm italic text-gray-400">{r.empty}</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
              <th className="px-3 py-2">{r.intitule}</th><th className="px-3 py-2">{r.type}</th><th className="px-3 py-2">{r.statut}</th>
              <th className="px-3 py-2">{r.dateRealisation}</th><th className="px-3 py-2">{r.constats}</th><th className="px-3 py-2" />
            </tr></thead>
            <tbody>
              {data.tests.map(row => {
                const cs = asConstats(row.constats)
                return (
                  <tr key={row.id} id={`test-${row.id}`} className={`border-b border-gray-100 dark:border-gray-800 ${focusId === row.id ? 'bg-amber-50 dark:bg-amber-500/10' : ''}`}>
                    <td className="px-3 py-2 font-medium">{row.intitule}{row.fonctionCritique && <span className="ml-2 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700" title={r.fonctionCritique}>FCI</span>}</td>
                    <td className="px-3 py-2 text-xs">{types[row.type] ?? row.type}</td>
                    <td className="px-3 py-2 text-xs">{statuts[row.statut] ?? row.statut}</td>
                    <td className="px-3 py-2 text-xs tabular-nums">{row.dateRealisation ? fmt(row.dateRealisation) : '—'}</td>
                    <td className="px-3 py-2 text-xs">{cs.length === 0 ? '—' : <ul className="space-y-1">{cs.map((c, index) => {
                      const key = `${row.id}:${index}`
                      return <li key={key}><span className={c.corrige ? 'text-green-700' : 'text-amber-700'}>{c.corrige ? '✓' : `S${c.severite}`} · {c.description}</span>{(() => { const a = data.actionsParConstat?.[row.id]?.[index]; if (!a || c.corrige) return null; return a.ouvertes > 0 ? <span className="ml-2 text-gray-500">{r.actionsOpen.replace('{n}', String(a.ouvertes))}</span> : <>{<span className="ml-2 text-green-700">{r.actionsDone}</span>}{data.canWrite && <button type="button" disabled={actionBusy === key} onClick={() => closeFinding(row.id, index)} className="ml-2 text-ebios-700 hover:underline disabled:opacity-50">{r.proposeClose}</button>}</> })()}{data.canWrite && !c.corrige && <><button type="button" disabled={actionBusy === key} onClick={() => promoteFinding(row.id, index)} className="ml-2 text-ebios-700 hover:underline disabled:opacity-50">{r.createAction}</button>{actionMsg[key] && <span role="status" className="ml-2 text-gray-500">{actionMsg[key]}</span>}</>}</li>
                    })}</ul>}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {data.canWrite && <>
                        <button type="button" onClick={() => edit(row)} className="text-xs text-ebios-700 hover:underline mr-3">{r.edit}</button>
                        <button type="button" onClick={() => remove(row.id)} className="text-xs text-red-700 hover:underline">{r.delete}</button>
                      </>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {!data.canWrite && <p className="text-xs text-gray-500">{r.readOnly}</p>}
    </div>
  )
}
