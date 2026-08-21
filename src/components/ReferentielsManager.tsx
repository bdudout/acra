'use client'

import { Plus, Trash2, Pencil, AlertTriangle, BookMarked, Lock, Gauge } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import ConfirmDialog from '@/components/ConfirmDialog'
import { parseExigences, REFERENTIEL_TYPES } from '@/lib/referentiel'

interface CouvExigence { ref: string; nom: string; statut: string; nbControles: number; nbAnomaliesAudit: number }
interface CouvSynthese { total: number; couverts: number; conformes: number; anomalies: number; nonCouverts: number; tauxCouverture: number; tauxConformite: number }

interface Ref {
  id?: string; code: string; nom: string; source: 'BUILTIN' | 'CUSTOM'
  type: string; version: string | null; nbExigences: number; actif: boolean
}
interface RefDetail { id: string; code: string; nom: string; type: string; version: string | null; description: string | null; exigences: { ref: string; nom: string; categorie?: string; type?: string }[] }

const emptyForm = { code: '', nom: '', type: 'PSSI', version: '', description: '', exigencesText: '' }

export default function ReferentielsManager({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation()
  const r = t.referentiels
  const [refs, setRefs] = useState<Ref[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [err, setErr] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [couv, setCouv] = useState<{ code: string; nom: string; parExigence: CouvExigence[]; synthese: CouvSynthese } | null>(null)
  const [couvLoading, setCouvLoading] = useState(false)

  const exigencesParsed = useMemo(() => parseExigences(form.exigencesText), [form.exigencesText])

  async function openCouverture(code: string, nom: string) {
    setCouv({ code, nom, parExigence: [], synthese: { total: 0, couverts: 0, conformes: 0, anomalies: 0, nonCouverts: 0, tauxCouverture: 0, tauxConformite: 0 } })
    setCouvLoading(true)
    const d = await fetch(`/api/referentiels/couverture?code=${encodeURIComponent(code)}`).then(x => x.ok ? x.json() : null).catch(() => null)
    setCouvLoading(false)
    if (d?.active) setCouv({ code, nom, parExigence: d.parExigence ?? [], synthese: d.synthese })
  }

  async function reload() {
    const d = await fetch('/api/referentiels').then(x => x.ok ? x.json() : null).catch(() => null)
    setRefs(d?.referentiels ?? [])
    setLoading(false)
  }
  useEffect(() => { reload() }, [])

  function openCreate() { setEditing(null); setForm({ ...emptyForm }); setErr(null); setShowForm(true) }
  async function openEdit(id: string) {
    const ref = await fetch(`/api/referentiels/${id}`).then(x => x.ok ? x.json() : null).catch(() => null) as RefDetail | null
    if (!ref) return
    setEditing(id)
    setForm({
      code: ref.code, nom: ref.nom, type: ref.type, version: ref.version ?? '', description: ref.description ?? '',
      exigencesText: (ref.exigences ?? []).map(e => [e.ref, e.nom, e.categorie ?? '', e.type ?? ''].filter(Boolean).join(' | ')).join('\n'),
    })
    setErr(null); setShowForm(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const url = editing ? `/api/referentiels/${editing}` : '/api/referentiels'
    const res = await fetch(url, {
      method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: form.code, nom: form.nom, type: form.type, version: form.version, description: form.description, exigences: exigencesParsed }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      const map: Record<string, string> = { code_requis: r.errorRequired, nom_requis: r.errorRequired, code_existant: r.errorCode }
      setErr(map[d.error] ?? d.error ?? 'Erreur')
      return
    }
    setShowForm(false); reload()
  }
  async function del(id: string) { await fetch(`/api/referentiels/${id}`, { method: 'DELETE' }); setConfirmDel(null); reload() }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-ebios-500'

  if (loading) return <div className="text-center py-12 text-gray-500">{t.loading}</div>
  const customs = refs.filter(x => x.source === 'CUSTOM')
  const builtins = refs.filter(x => x.source === 'BUILTIN')

  const typeBadge = (type: string, source: string) => (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${source === 'BUILTIN' ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' : 'bg-ebios-100 text-ebios-700 dark:bg-ebios-500/15 dark:text-ebios-300'}`}>
      {source === 'CUSTOM' ? (r.typeOpt[type as keyof typeof r.typeOpt] ?? type) : type}
    </span>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100"><BookMarked size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" /> {r.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">{r.subtitle}</p>
        </div>
        {canManage && (
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 bg-ebios-600 hover:bg-ebios-700 text-white text-sm font-medium py-2 px-3 rounded-lg">
            <Plus size={15} aria-hidden="true" /> {r.add}
          </button>
        )}
      </div>

      {!canManage && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{r.readOnly}</div>
      )}

      {showForm && canManage && (
        <form onSubmit={save} className="card p-5 space-y-4">
          {err && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 text-sm"><AlertTriangle size={14} className="inline align-[-0.15em] mr-1" aria-hidden="true" /> {err}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{r.champ.code}</span>
              <input className={`mt-1 ${inputCls}`} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="PSSI-2026" required /></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{r.champ.nom}</span>
              <input className={`mt-1 ${inputCls}`} value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} required /></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{r.champ.type}</span>
              <select className={`mt-1 ${inputCls}`} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {REFERENTIEL_TYPES.map(ty => <option key={ty} value={ty}>{r.typeOpt[ty]}</option>)}
              </select></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{r.champ.version}</span>
              <input className={`mt-1 ${inputCls}`} value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} placeholder="v1.0" /></label>
            <label className="block sm:col-span-2"><span className="text-sm text-gray-700 dark:text-gray-300">{r.champ.description}</span>
              <input className={`mt-1 ${inputCls}`} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
            <label className="block sm:col-span-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">{r.champ.exigences}</span>
              <span className="block text-xs text-gray-400 mb-1">{r.exigencesHint}</span>
              <textarea className={`mt-1 ${inputCls} font-mono text-xs`} rows={8} value={form.exigencesText}
                onChange={e => setForm({ ...form, exigencesText: e.target.value })}
                placeholder={'PSSI-1 | Politique validée par la direction | Gouvernance | ORGANISATIONNELLE\nPSSI-2 | Chiffrement des postes | Protection | TECHNOLOGIQUE'} />
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">{r.exigencesCount.replace('{n}', String(exigencesParsed.length))}</span>
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-ebios-600 hover:bg-ebios-700 text-white text-sm font-medium py-2 px-4 rounded-lg">{t.save}</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm py-2 px-4">{t.cancel}</button>
          </div>
        </form>
      )}

      {/* Référentiels custom */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{r.yours}</h2>
        {customs.length === 0 ? (
          <div className="card p-8 text-center text-gray-400 dark:text-gray-500 text-sm">{r.empty}</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs">
                <tr>
                  <th className="text-left font-medium px-3 py-2">{r.col.nom}</th>
                  <th className="text-left font-medium px-3 py-2">{r.col.type}</th>
                  <th className="text-left font-medium px-3 py-2">{r.col.version}</th>
                  <th className="text-right font-medium px-3 py-2">{r.col.exigences}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {customs.map(x => (
                  <tr key={x.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800 dark:text-gray-100">{x.nom}</div>
                      <div className="text-[11px] text-gray-400 font-mono">{x.code}</div>
                    </td>
                    <td className="px-3 py-2">{typeBadge(x.type, x.source)}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{x.version ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-200">{x.nbExigences}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => openCouverture(x.code, x.nom)} className="text-gray-400 hover:text-ebios-600 p-1" aria-label={r.couverture} title={r.couverture}><Gauge size={15} aria-hidden="true" /></button>
                      {canManage && <>
                        <button onClick={() => x.id && openEdit(x.id)} className="text-gray-400 hover:text-ebios-600 p-1" aria-label={t.save}><Pencil size={15} aria-hidden="true" /></button>
                        <button onClick={() => x.id && setConfirmDel(x.id)} className="text-gray-400 hover:text-red-600 p-1" aria-label={t.delete}><Trash2 size={15} aria-hidden="true" /></button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cadres livrés (lecture seule) */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5"><Lock size={13} aria-hidden="true" /> {r.builtin}</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs">
              <tr>
                <th className="text-left font-medium px-3 py-2">{r.col.nom}</th>
                <th className="text-left font-medium px-3 py-2">{r.col.version}</th>
                <th className="text-right font-medium px-3 py-2">{r.col.exigences}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {builtins.map(x => (
                <tr key={x.code} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800 dark:text-gray-100">{x.nom}</div>
                    <div className="text-[11px] text-gray-400">{x.type}</div>
                  </td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{x.version ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-200">{x.nbExigences}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => openCouverture(x.code, x.nom)} className="text-gray-400 hover:text-ebios-600 p-1" aria-label={r.couverture} title={r.couverture}><Gauge size={15} aria-hidden="true" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {couv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCouv(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b border-gray-100 dark:border-gray-700">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5"><Gauge size={16} aria-hidden="true" /> {r.couvertureTitle}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{couv.nom}</p>
              </div>
              <button onClick={() => setCouv(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none" aria-label={t.cancel}>×</button>
            </div>
            <div className="p-5 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <div className="card p-3"><div className="text-xl font-bold tabular-nums">{couv.synthese.couverts}/{couv.synthese.total}</div><div className="text-[11px] text-gray-500">{r.covKpi.couverts}</div></div>
                <div className="card p-3"><div className="text-xl font-bold tabular-nums text-green-600 dark:text-green-400">{couv.synthese.conformes}</div><div className="text-[11px] text-gray-500">{r.covKpi.conformes}</div></div>
                <div className="card p-3"><div className={`text-xl font-bold tabular-nums ${couv.synthese.anomalies > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{couv.synthese.anomalies}</div><div className="text-[11px] text-gray-500">{r.covKpi.anomalies}</div></div>
                <div className="card p-3"><div className="text-xl font-bold tabular-nums">{couv.synthese.tauxCouverture}%</div><div className="text-[11px] text-gray-500">{r.covKpi.taux}</div></div>
              </div>
              {couvLoading ? <div className="text-center py-6 text-gray-400 text-sm">{t.loading}</div>
                : couv.parExigence.length === 0 ? <div className="text-center py-6 text-gray-400 text-sm">{r.covEmpty}</div>
                : (
                  <div className="space-y-1">
                    {couv.parExigence.map(e => (
                      <div key={e.ref} className="flex items-center gap-2 text-sm border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-1.5">
                        <span className="font-mono text-[11px] text-gray-400 w-16 shrink-0">{e.ref}</span>
                        <span className="flex-1 text-gray-700 dark:text-gray-200 truncate" title={e.nom}>{e.nom}</span>
                        {e.nbControles > 0 && <span className="text-[10px] text-gray-400 shrink-0">{r.covControles.replace('{n}', String(e.nbControles))}</span>}
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${COV_BADGE[e.statut] ?? COV_BADGE.NON_COUVERT}`}>{r.covStatut[e.statut as keyof typeof r.covStatut] ?? e.statut}</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {confirmDel && (
        <ConfirmDialog message={r.deleteConfirm} confirmLabel={t.delete} onConfirm={() => del(confirmDel)} onCancel={() => setConfirmDel(null)} />
      )}
    </div>
  )
}

const COV_BADGE: Record<string, string> = {
  NON_COUVERT: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
  CONFORME: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  PARTIEL: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  ANOMALIE: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
}
