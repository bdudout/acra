'use client'

import { Plus, Trash2, Download, FileText, AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import ConfirmDialog from '@/components/ConfirmDialog'
import { DOCUMENT_TYPES, DOCUMENT_PORTEES } from '@/lib/document'

interface Doc {
  id: string; titre: string; type: string; portee: string; referentielCode: string | null; risqueId: string | null
  version: string | null; description: string | null; dateDocument: string | null; dateRevue: string | null
  fichierNom: string; mime: string; taille: number; createdAt: string
}
interface RefLite { code: string; nom: string; source: string }
interface RiskLite { id: string; intitule: string }

const TYPE_BADGE: Record<string, string> = {
  PSSI: 'bg-ebios-100 text-ebios-700 dark:bg-ebios-500/15 dark:text-ebios-300',
  STRATEGIE: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  POLITIQUE: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  PROCEDURE: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  PREUVE: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  AUTRE: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

const emptyForm = { titre: '', type: 'PSSI', portee: 'ORG', referentielId: '', risqueId: '', version: '', description: '', dateDocument: '', dateRevue: '' }

function humanSize(n: number): string {
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`
  return `${(n / 1024 / 1024).toFixed(1)} Mo`
}

export default function DocumentsManager({ canManage }: { canManage: boolean }) {
  const { t, locale } = useTranslation()
  const d = t.documents
  const [docs, setDocs] = useState<Doc[]>([])
  const [refs, setRefs] = useState<RefLite[]>([])
  const [risks, setRisks] = useState<RiskLite[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  async function reload() {
    const [dd, rr, qq] = await Promise.all([
      fetch('/api/documents').then(x => x.ok ? x.json() : null).catch(() => null),
      fetch('/api/referentiels').then(x => x.ok ? x.json() : null).catch(() => null),
      fetch('/api/risk-items').then(x => x.ok ? x.json() : null).catch(() => null),
    ])
    setDocs(dd?.documents ?? [])
    setRefs(rr?.referentiels ?? [])
    setRisks((qq?.risks ?? []).map((r: RiskLite) => ({ id: r.id, intitule: r.intitule })))
    setLoading(false)
  }
  useEffect(() => { reload() }, [])

  function openCreate() { setForm({ ...emptyForm }); setFile(null); setErr(null); setShowForm(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setErr(d.errorFile); return }
    setBusy(true); setErr(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('titre', form.titre); fd.append('type', form.type); fd.append('portee', form.portee)
    if (form.portee === 'REFERENTIEL') fd.append('referentielId', form.referentielId)
    if (form.portee === 'RISQUE') fd.append('risqueId', form.risqueId)
    fd.append('version', form.version); fd.append('description', form.description)
    if (form.dateDocument) fd.append('dateDocument', form.dateDocument)
    if (form.dateRevue) fd.append('dateRevue', form.dateRevue)
    const res = await fetch('/api/documents', { method: 'POST', body: fd })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      const map: Record<string, string> = {
        titre_requis: d.errorRequired, fichier_requis: d.errorFile, fichier_trop_gros: d.errorTooBig,
        mime_interdit: d.errorMime, referentiel_requis: d.errorRefRequired, risque_requis: d.errorRisqueRequired,
      }
      setErr(map[j.error] ?? j.error ?? 'Erreur')
      return
    }
    setShowForm(false); reload()
  }
  async function del(id: string) { await fetch(`/api/documents/${id}`, { method: 'DELETE' }); setConfirmDel(null); reload() }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-ebios-500'
  const jour = (s: string | null) => (s ? new Date(s).toLocaleDateString(locale) : '—')
  const refLabel = (code: string | null) => (code ? (refs.find(r => r.code === code)?.nom ?? code) : '—')

  if (loading) return <div className="text-center py-12 text-gray-500">{t.loading}</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100"><FileText size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" /> {d.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">{d.subtitle}</p>
        </div>
        {canManage && (
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 bg-ebios-600 hover:bg-ebios-700 text-white text-sm font-medium py-2 px-3 rounded-lg">
            <Plus size={15} aria-hidden="true" /> {d.add}
          </button>
        )}
      </div>

      {!canManage && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{d.readOnly}</div>
      )}

      {showForm && canManage && (
        <form onSubmit={save} className="card p-5 space-y-4">
          {err && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 text-sm"><AlertTriangle size={14} className="inline align-[-0.15em] mr-1" aria-hidden="true" /> {err}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="text-sm text-gray-700 dark:text-gray-300">{d.champ.fichier}</span>
              <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} className={`mt-1 ${inputCls}`} required />
              <span className="block text-xs text-gray-400 mt-1">{d.fichierHint}</span></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{d.champ.titre}</span>
              <input className={`mt-1 ${inputCls}`} value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })} required /></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{d.champ.type}</span>
              <select className={`mt-1 ${inputCls}`} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {DOCUMENT_TYPES.map(ty => <option key={ty} value={ty}>{d.typeOpt[ty]}</option>)}
              </select></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{d.champ.portee}</span>
              <select className={`mt-1 ${inputCls}`} value={form.portee} onChange={e => setForm({ ...form, portee: e.target.value })}>
                {DOCUMENT_PORTEES.map(p => <option key={p} value={p}>{d.porteeOpt[p]}</option>)}
              </select></label>
            {form.portee === 'REFERENTIEL' && (
              <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{d.champ.referentiel}</span>
                <select className={`mt-1 ${inputCls}`} value={form.referentielId} onChange={e => setForm({ ...form, referentielId: e.target.value })} required>
                  <option value="">—</option>
                  {refs.map(r => <option key={r.code} value={r.code}>{r.nom}{r.source === 'CUSTOM' ? '' : ' ·'}</option>)}
                </select></label>
            )}
            {form.portee === 'RISQUE' && (
              <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{d.champ.risque}</span>
                <select className={`mt-1 ${inputCls}`} value={form.risqueId} onChange={e => setForm({ ...form, risqueId: e.target.value })} required>
                  <option value="">—</option>
                  {risks.map(r => <option key={r.id} value={r.id}>{r.intitule}</option>)}
                </select></label>
            )}
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{d.champ.version}</span>
              <input className={`mt-1 ${inputCls}`} value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} placeholder="v1.0" /></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{d.champ.dateDocument}</span>
              <input type="date" className={`mt-1 ${inputCls}`} value={form.dateDocument} onChange={e => setForm({ ...form, dateDocument: e.target.value })} /></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{d.champ.dateRevue}</span>
              <input type="date" className={`mt-1 ${inputCls}`} value={form.dateRevue} onChange={e => setForm({ ...form, dateRevue: e.target.value })} /></label>
            <label className="block sm:col-span-2"><span className="text-sm text-gray-700 dark:text-gray-300">{d.champ.description}</span>
              <input className={`mt-1 ${inputCls}`} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="bg-ebios-600 hover:bg-ebios-700 text-white text-sm font-medium py-2 px-4 rounded-lg disabled:opacity-50">{busy ? d.uploading : t.save}</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm py-2 px-4">{t.cancel}</button>
          </div>
        </form>
      )}

      {docs.length === 0 ? (
        <div className="card p-10 text-center text-gray-400 dark:text-gray-500 text-sm">{d.empty}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs">
              <tr>
                <th className="text-left font-medium px-3 py-2">{d.col.titre}</th>
                <th className="text-left font-medium px-3 py-2">{d.col.type}</th>
                <th className="text-left font-medium px-3 py-2">{d.col.rattachement}</th>
                <th className="text-left font-medium px-3 py-2">{d.col.taille}</th>
                <th className="text-left font-medium px-3 py-2">{d.col.revue}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map(x => (
                <tr key={x.id} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800 dark:text-gray-100">{x.titre}{x.version && <span className="text-[11px] text-gray-400 ml-1.5">{x.version}</span>}</div>
                    <div className="text-[11px] text-gray-400">{x.fichierNom}</div>
                  </td>
                  <td className="px-3 py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE[x.type] ?? TYPE_BADGE.AUTRE}`}>{d.typeOpt[x.type as keyof typeof d.typeOpt] ?? x.type}</span></td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                    {x.portee === 'REFERENTIEL' ? refLabel(x.referentielCode) : x.portee === 'RISQUE' ? (risks.find(r => r.id === x.risqueId)?.intitule ?? d.porteeOpt.RISQUE) : d.porteeOpt.ORG}
                  </td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">{humanSize(x.taille)}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">{jour(x.dateRevue)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <a href={`/api/documents/${x.id}/download`} className="text-gray-400 hover:text-ebios-600 p-1 inline-block" aria-label={d.download}><Download size={15} aria-hidden="true" /></a>
                    {canManage && <button onClick={() => setConfirmDel(x.id)} className="text-gray-400 hover:text-red-600 p-1" aria-label={t.delete}><Trash2 size={15} aria-hidden="true" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDel && (
        <ConfirmDialog message={d.deleteConfirm} confirmLabel={t.delete} onConfirm={() => del(confirmDel)} onCancel={() => setConfirmDel(null)} />
      )}
    </div>
  )
}
