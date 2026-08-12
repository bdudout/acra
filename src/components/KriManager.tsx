'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { taxonomieLabel, type TaxonomieNode } from '@/lib/taxonomie'

type KriStatut = 'NORMAL' | 'ALERTE' | 'CRITIQUE' | 'INCONNU'
type KriTendance = 'AMELIORATION' | 'DEGRADATION' | 'STABLE' | 'INCONNU'

interface KriRow {
  id: string; intitule: string; description: string | null; unite: string | null
  sens: 'HAUSSE' | 'BAISSE'; seuilAlerte: number; seuilCritique: number; frequence: string
  responsable: string | null; taxonomieCode: string | null; riskItemId: string | null; riskIntitule: string | null; actif: boolean
  derniereValeur: number | null; derniereMesureLe: string | null; statut: KriStatut; tendance: KriTendance
}
interface KriSynthese { total: number; normal: number; alerte: number; critique: number; inconnu: number; enAlerte: number }
interface Mesure { id: string; valeur: number; dateMesure: string; commentaire: string | null }

const STATUT_BADGE: Record<KriStatut, string> = {
  NORMAL: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  ALERTE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  CRITIQUE: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  INCONNU: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
}
// Tendance sémantique (amélioration/dégradation du risque), pas la direction de la valeur.
const TENDANCE_ICON: Record<KriTendance, string> = { AMELIORATION: '↘', DEGRADATION: '↗', STABLE: '→', INCONNU: '·' }
const TENDANCE_COLOR: Record<KriTendance, string> = { AMELIORATION: 'text-green-600 dark:text-green-400', DEGRADATION: 'text-red-600 dark:text-red-400', STABLE: 'text-gray-400', INCONNU: 'text-gray-400' }

const emptyForm = { intitule: '', description: '', unite: '', sens: 'HAUSSE', seuilAlerte: '', seuilCritique: '', frequence: 'MENSUEL', responsable: '', taxonomieCode: '', riskItemId: '' }

export default function KriManager({ canDefine, canMeasure }: { canDefine: boolean; canMeasure: boolean }) {
  const { t, locale } = useTranslation()
  const k = t.kri
  const [data, setData] = useState<{ kris: KriRow[]; synthese: KriSynthese } | null>(null)
  const [loading, setLoading] = useState(true)
  const [taxo, setTaxo] = useState<TaxonomieNode[]>([])
  const [risks, setRisks] = useState<{ id: string; intitule: string }[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [expanded, setExpanded] = useState<string | null>(null)
  const [mesures, setMesures] = useState<Record<string, Mesure[]>>({})
  const [mesureForm, setMesureForm] = useState<{ valeur: string; commentaire: string }>({ valeur: '', commentaire: '' })
  const [err, setErr] = useState<string | null>(null)

  const tr = useMemo(() => (key: string) => key.split('.').reduce<unknown>((o, kk) => (o as Record<string, unknown>)?.[kk], t) as string ?? '', [t])

  async function reload() {
    const [kk, tt, rr] = await Promise.all([
      fetch('/api/kri').then(x => x.ok ? x.json() : { kris: [], synthese: null }),
      fetch('/api/taxonomie').then(x => x.ok ? x.json() : { taxonomie: [] }),
      fetch('/api/risk-items').then(x => x.ok ? x.json() : { risks: [] }),
    ])
    setData({ kris: kk.kris ?? [], synthese: kk.synthese ?? { total: 0, normal: 0, alerte: 0, critique: 0, inconnu: 0, enAlerte: 0 } })
    setTaxo(tt.taxonomie ?? []); setRisks((rr.risks ?? []).map((r: { id: string; intitule: string }) => ({ id: r.id, intitule: r.intitule })))
    setLoading(false)
  }
  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (n: number | null) => n == null ? '—' : new Intl.NumberFormat(locale).format(n)
  const errMsg = (code: string | undefined) => (code && (k.errors as Record<string, string>)[code]) || k.errors.erreur

  function openCreate() { setEditing(null); setForm({ ...emptyForm }); setShowForm(true); setErr(null) }
  function openEdit(row: KriRow) {
    setEditing(row.id); setShowForm(true); setErr(null)
    setForm({
      intitule: row.intitule, description: row.description ?? '', unite: row.unite ?? '', sens: row.sens,
      seuilAlerte: String(row.seuilAlerte), seuilCritique: String(row.seuilCritique), frequence: row.frequence,
      responsable: row.responsable ?? '', taxonomieCode: row.taxonomieCode ?? '', riskItemId: row.riskItemId ?? '',
    })
  }

  async function submit() {
    setErr(null)
    const body = {
      ...form,
      seuilAlerte: form.seuilAlerte === '' ? '' : Number(form.seuilAlerte),
      seuilCritique: form.seuilCritique === '' ? '' : Number(form.seuilCritique),
      taxonomieCode: form.taxonomieCode || null, riskItemId: form.riskItemId || null,
    }
    const res = await fetch(editing ? `/api/kri/${editing}` : '/api/kri', {
      method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (res.ok) { setShowForm(false); reload() }
    else { const d = await res.json().catch(() => ({})); setErr(errMsg(d.error)) }
  }

  async function remove(id: string) {
    if (!confirm(k.confirmDelete)) return
    const res = await fetch(`/api/kri/${id}`, { method: 'DELETE' })
    if (res.ok) reload()
  }

  async function toggleExpand(id: string) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id); setMesureForm({ valeur: '', commentaire: '' }); setErr(null)
    const res = await fetch(`/api/kri/${id}`)
    if (res.ok) { const d = await res.json(); setMesures(m => ({ ...m, [id]: d.mesures ?? [] })) }
  }

  async function addMesure(id: string) {
    setErr(null)
    const res = await fetch(`/api/kri/${id}/mesures`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valeur: mesureForm.valeur === '' ? '' : Number(mesureForm.valeur), commentaire: mesureForm.commentaire }),
    })
    if (res.ok) { setMesureForm({ valeur: '', commentaire: '' }); await reload(); const d = await fetch(`/api/kri/${id}`).then(x => x.json()); setMesures(m => ({ ...m, [id]: d.mesures ?? [] })) }
    else { const d = await res.json().catch(() => ({})); setErr(errMsg(d.error)) }
  }

  if (loading) return <p className="text-gray-400">…</p>
  const s = data!.synthese

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">📈 {k.title}</h1>
        {canDefine && <button onClick={openCreate} className="btn-primary text-sm">{k.newBtn}</button>}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{k.subtitle}</p>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Tile label={k.total} value={s.total} />
        <Tile label={k.kpiCritiques} value={s.critique} tone={s.critique > 0 ? 'red' : undefined} />
        <Tile label={k.kpiAlertes} value={s.alerte} tone={s.alerte > 0 ? 'amber' : undefined} />
        <Tile label={k.kpiNormaux} value={s.normal} tone="green" />
      </div>

      {showForm && (
        <div className="card p-4 mb-6">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{editing ? k.editTitle : k.newTitle}</p>
          {err && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{err}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className="input" placeholder={k.intitulePlaceholder} value={form.intitule} onChange={e => setForm(f => ({ ...f, intitule: e.target.value }))} />
            <input className="input" placeholder={k.unitePlaceholder} value={form.unite} onChange={e => setForm(f => ({ ...f, unite: e.target.value }))} />
            <label className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">{k.sens}
              <select className="input flex-1" value={form.sens} onChange={e => setForm(f => ({ ...f, sens: e.target.value }))}>
                <option value="HAUSSE">{k.sensLabels.HAUSSE}</option>
                <option value="BAISSE">{k.sensLabels.BAISSE}</option>
              </select>
            </label>
            <label className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">{k.frequence}
              <select className="input flex-1" value={form.frequence} onChange={e => setForm(f => ({ ...f, frequence: e.target.value }))}>
                {(['MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL'] as const).map(fr => <option key={fr} value={fr}>{k.frequenceLabels[fr]}</option>)}
              </select>
            </label>
            <label className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">{k.seuilAlerte}
              <input type="number" className="input flex-1" value={form.seuilAlerte} onChange={e => setForm(f => ({ ...f, seuilAlerte: e.target.value }))} />
            </label>
            <label className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">{k.seuilCritique}
              <input type="number" className="input flex-1" value={form.seuilCritique} onChange={e => setForm(f => ({ ...f, seuilCritique: e.target.value }))} />
            </label>
            <input className="input" placeholder={k.responsablePlaceholder} value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} />
            <select className="input" value={form.taxonomieCode} onChange={e => setForm(f => ({ ...f, taxonomieCode: e.target.value }))}>
              <option value="">{k.categorieNone}</option>
              {taxo.map(c => <option key={c.code} value={c.code}>{taxonomieLabel(c, tr)}</option>)}
            </select>
            <select className="input sm:col-span-2" value={form.riskItemId} onChange={e => setForm(f => ({ ...f, riskItemId: e.target.value }))}>
              <option value="">{k.riskNone}</option>
              {risks.map(r => <option key={r.id} value={r.id}>{r.intitule}</option>)}
            </select>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={submit} className="btn-primary text-sm">{editing ? k.save : k.add}</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">{k.cancel}</button>
          </div>
        </div>
      )}

      {data!.kris.length === 0 ? <p className="text-sm text-gray-400 italic py-6 text-center">{k.empty}</p> : (
        <div className="space-y-2">
          {data!.kris.map(row => (
            <div key={row.id} className={`card p-0 overflow-hidden ${!row.actif ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => toggleExpand(row.id)} className="flex-1 text-left flex items-center gap-3 min-w-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_BADGE[row.statut]}`}>{k.statutLabels[row.statut]}</span>
                  <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{row.intitule}</span>
                  {row.riskIntitule && <span className="text-xs text-gray-400 truncate hidden sm:inline">· {row.riskIntitule}</span>}
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {fmt(row.derniereValeur)}{row.unite ? ` ${row.unite}` : ''}
                  <span className={`ml-1 ${TENDANCE_COLOR[row.tendance]}`} title={k.tendanceLabels[row.tendance]}>{TENDANCE_ICON[row.tendance]}</span>
                </span>
                {canDefine && <span className="flex gap-2 text-xs">
                  <button onClick={() => openEdit(row)} className="text-ebios-600 hover:underline">{k.edit}</button>
                  <button onClick={() => remove(row.id)} className="text-red-600 hover:underline">{k.delete}</button>
                </span>}
              </div>
              {expanded === row.id && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 bg-gray-50 dark:bg-gray-800/40">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {k.sens}: {k.sensLabels[row.sens]} · {k.seuilAlerte} {fmt(row.seuilAlerte)} · {k.seuilCritique} {fmt(row.seuilCritique)}
                    {row.responsable ? ` · ${row.responsable}` : ''}
                  </p>
                  {canMeasure && (
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <input type="number" className="input w-28" placeholder={k.valeurPlaceholder} value={mesureForm.valeur} onChange={e => setMesureForm(m => ({ ...m, valeur: e.target.value }))} />
                      <input className="input flex-1 min-w-[8rem]" placeholder={k.commentairePlaceholder} value={mesureForm.commentaire} onChange={e => setMesureForm(m => ({ ...m, commentaire: e.target.value }))} />
                      <button onClick={() => addMesure(row.id)} className="btn-primary text-sm">{k.addMesure}</button>
                    </div>
                  )}
                  {err && expanded === row.id && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{err}</p>}
                  {(mesures[row.id]?.length ?? 0) === 0 ? <p className="text-xs text-gray-400 italic">{k.aucuneMesure}</p> : (
                    <ul className="text-sm space-y-1">
                      {mesures[row.id].map(m => (
                        <li key={m.id} className="flex items-center gap-2">
                          <span className="text-gray-400 text-xs w-24">{new Date(m.dateMesure).toLocaleDateString(locale)}</span>
                          <span className="font-medium text-gray-700 dark:text-gray-200">{fmt(m.valeur)}{row.unite ? ` ${row.unite}` : ''}</span>
                          {m.commentaire && <span className="text-xs text-gray-400 truncate">— {m.commentaire}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: number | string; tone?: 'red' | 'amber' | 'green' }) {
  const color = tone === 'red' ? 'text-red-600 dark:text-red-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : tone === 'green' ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-gray-100'
  return (
    <div className="card p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
