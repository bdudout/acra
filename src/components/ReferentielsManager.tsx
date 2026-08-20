'use client'

import { Plus, Trash2, Pencil, AlertTriangle, BookMarked, Lock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import ConfirmDialog from '@/components/ConfirmDialog'
import { parseExigences, REFERENTIEL_TYPES } from '@/lib/referentiel'

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

  const exigencesParsed = useMemo(() => parseExigences(form.exigencesText), [form.exigencesText])

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
                  {canManage && <th className="px-3 py-2"></th>}
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
                    {canManage && (
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button onClick={() => x.id && openEdit(x.id)} className="text-gray-400 hover:text-ebios-600 p-1" aria-label={t.save}><Pencil size={15} aria-hidden="true" /></button>
                        <button onClick={() => x.id && setConfirmDel(x.id)} className="text-gray-400 hover:text-red-600 p-1" aria-label={t.delete}><Trash2 size={15} aria-hidden="true" /></button>
                      </td>
                    )}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirmDel && (
        <ConfirmDialog message={r.deleteConfirm} confirmLabel={t.delete} onConfirm={() => del(confirmDel)} onCancel={() => setConfirmDel(null)} />
      )}
    </div>
  )
}
