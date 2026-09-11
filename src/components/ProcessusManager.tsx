'use client'

import { FolderTree } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { buildProcessusTree, type ProcessusTree } from '@/lib/processus'
import { CRITICITES_DORA, formatDuree, type CriticiteDora } from '@/lib/processus-dora'

interface Processus {
  id: string; parentId: string | null; nom: string; description: string | null
  proprietaire: string | null; criticite: number | null
  criticiteDora: string | null; rtoMinutes: number | null; rpoMinutes: number | null
  ordre: number; actif: boolean
}
type Form = {
  nom: string; parentId: string; proprietaire: string; criticite: string
  criticiteDora: string; rtoHeures: string; rpoHeures: string
}
const EMPTY: Form = { nom: '', parentId: '', proprietaire: '', criticite: '', criticiteDora: '', rtoHeures: '', rpoHeures: '' }

// Saisie en heures (usuel pour RTO/RPO) → stockage en minutes ; '' → null.
const heuresToMinutes = (h: string): number | null => {
  const n = Number(h)
  return h.trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n * 60) : null
}
const minutesToHeures = (m: number | null): string => (m == null ? '' : String(m / 60))

// Couleurs des paliers DORA (statique → hors composant).
const DORA_STYLE: Record<CriticiteDora, string> = {
  CRITIQUE: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  IMPORTANTE: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  NON_CRITIQUE: 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-300',
}

export default function ProcessusManager({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation()
  const p = t.processus
  const [list, setList] = useState<Processus[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Form>(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    const res = await fetch('/api/processus')
    const data = res.ok ? await res.json() : { processus: [] }
    setList(data.processus ?? [])
    setLoading(false)
  }
  useEffect(() => { reload() }, [])

  const tree = useMemo(() => buildProcessusTree(list), [list])
  // Options de parent (exclut le nœud en édition pour éviter l'auto-parentage évident).
  const parentOptions = useMemo(() => list.filter(x => x.id !== editId), [list, editId])

  function err(code: string) { return (p.errors as Record<string, string>)[code] ?? code }

  async function submit() {
    if (!form.nom.trim()) { setError(err('nom_requis')); return }
    setBusy(true); setError(null)
    const payload = {
      nom: form.nom, parentId: form.parentId || null,
      proprietaire: form.proprietaire || null,
      criticite: form.criticite ? Number(form.criticite) : null,
      criticiteDora: form.criticiteDora || null,
      rtoMinutes: heuresToMinutes(form.rtoHeures),
      rpoMinutes: heuresToMinutes(form.rpoHeures),
    }
    const res = await fetch(editId ? `/api/processus/${editId}` : '/api/processus', {
      method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    setForm(EMPTY); setEditId(null); reload()
  }

  function startEdit(x: Processus) {
    setEditId(x.id)
    setForm({
      nom: x.nom, parentId: x.parentId ?? '', proprietaire: x.proprietaire ?? '', criticite: x.criticite?.toString() ?? '',
      criticiteDora: x.criticiteDora ?? '', rtoHeures: minutesToHeures(x.rtoMinutes), rpoHeures: minutesToHeures(x.rpoMinutes),
    })
    setError(null)
  }
  async function remove(id: string) {
    if (!confirm(p.confirmDelete)) return
    await fetch(`/api/processus/${id}`, { method: 'DELETE' })
    if (editId === id) { setEditId(null); setForm(EMPTY) }
    reload()
  }

  function renderNodes(nodes: ProcessusTree<Processus>[], depth = 0): React.ReactNode {
    return nodes.map(n => (
      <div key={n.id}>
        <div className="flex items-center gap-2 py-2 border-b border-gray-100 dark:border-gray-800" style={{ paddingLeft: `${depth * 20}px` }}>
          <span className="text-gray-400 text-xs">{depth > 0 ? '↳' : '▸'}</span>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100 flex-1">{n.nom}</span>
          {n.criticite != null && <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{p.criticiteShort} {n.criticite}</span>}
          {n.criticiteDora && (
            <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${DORA_STYLE[n.criticiteDora as CriticiteDora] ?? 'bg-gray-100 text-gray-700'}`} title={p.criticiteDoraHint}>
              {p.fciBadge} · {p.doraLevels[n.criticiteDora as CriticiteDora] ?? n.criticiteDora}
            </span>
          )}
          {n.rtoMinutes != null && <span className="text-[11px] text-gray-500 hidden sm:inline">{p.rtoShort} {formatDuree(n.rtoMinutes, p.dureeUnites)}</span>}
          {n.rpoMinutes != null && <span className="text-[11px] text-gray-500 hidden sm:inline">{p.rpoShort} {formatDuree(n.rpoMinutes, p.dureeUnites)}</span>}
          {n.proprietaire && <span className="text-xs text-gray-400 hidden sm:inline">{n.proprietaire}</span>}
          {canEdit && <>
            <button onClick={() => startEdit(n)} className="text-xs text-ebios-600 hover:underline">{p.edit}</button>
            <button onClick={() => remove(n.id)} className="text-xs text-red-500 hover:underline">{p.delete}</button>
          </>}
        </div>
        {n.enfants.length > 0 && renderNodes(n.enfants, depth + 1)}
      </div>
    ))
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1"><FolderTree size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" /> {p.title}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{p.subtitle}</p>

      {canEdit && (
        <div className="card p-4 mb-5 space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{editId ? p.editTitle : p.addTitle}</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder={p.nomPlaceholder} className="px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
            <select value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))} className="px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm">
              <option value="">{p.noParent}</option>
              {parentOptions.map(x => <option key={x.id} value={x.id}>{x.nom}</option>)}
            </select>
            <input value={form.proprietaire} onChange={e => setForm(f => ({ ...f, proprietaire: e.target.value }))} placeholder={p.ownerPlaceholder} className="px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
            <select value={form.criticite} onChange={e => setForm(f => ({ ...f, criticite: e.target.value }))} className="px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm">
              <option value="">{p.criticiteNone}</option>
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{p.criticiteShort} {n}</option>)}
            </select>
          </div>

          {/* Classification DORA (FCI) + objectifs de continuité (RTO=DIMA, RPO=PDMA). */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-gray-100 dark:border-gray-800">
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{p.criticiteDoraLabel}</span>
              <select value={form.criticiteDora} onChange={e => setForm(f => ({ ...f, criticiteDora: e.target.value }))} className="px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm">
                <option value="">{p.criticiteDoraNone}</option>
                {CRITICITES_DORA.map(c => <option key={c} value={c}>{p.doraLevels[c]}</option>)}
              </select>
              <span className="text-[11px] text-gray-400">{p.criticiteDoraHint}</span>
            </label>
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{p.rtoLabel}</span>
              <input type="number" min={0} step={0.25} value={form.rtoHeures} onChange={e => setForm(f => ({ ...f, rtoHeures: e.target.value }))} placeholder={p.dureeHeuresPlaceholder} className="px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
              <span className="text-[11px] text-gray-400">{form.rtoHeures.trim() !== '' && Number.isFinite(Number(form.rtoHeures)) ? `${p.dureeApercu} ${formatDuree(heuresToMinutes(form.rtoHeures), p.dureeUnites)}` : p.rtoHint}</span>
            </label>
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{p.rpoLabel}</span>
              <input type="number" min={0} step={0.25} value={form.rpoHeures} onChange={e => setForm(f => ({ ...f, rpoHeures: e.target.value }))} placeholder={p.dureeHeuresPlaceholder} className="px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
              <span className="text-[11px] text-gray-400">{form.rpoHeures.trim() !== '' && Number.isFinite(Number(form.rpoHeures)) ? `${p.dureeApercu} ${formatDuree(heuresToMinutes(form.rpoHeures), p.dureeUnites)}` : p.rpoHint}</span>
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{editId ? p.save : p.add}</button>
            {editId && <button onClick={() => { setEditId(null); setForm(EMPTY); setError(null) }} className="text-sm text-gray-500 hover:text-gray-700">{p.cancel}</button>}
          </div>
        </div>
      )}

      <div className="card p-4">
        {loading ? <p className="text-sm text-gray-400">…</p>
          : tree.length === 0 ? <p className="text-sm text-gray-400 italic">{p.empty}</p>
          : renderNodes(tree)}
      </div>
    </div>
  )
}
