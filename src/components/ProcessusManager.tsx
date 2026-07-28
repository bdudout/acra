'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { buildProcessusTree, type ProcessusTree } from '@/lib/processus'

interface Processus {
  id: string; parentId: string | null; nom: string; description: string | null
  proprietaire: string | null; criticite: number | null; ordre: number; actif: boolean
}
type Form = { nom: string; parentId: string; proprietaire: string; criticite: string }
const EMPTY: Form = { nom: '', parentId: '', proprietaire: '', criticite: '' }

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
    setForm({ nom: x.nom, parentId: x.parentId ?? '', proprietaire: x.proprietaire ?? '', criticite: x.criticite?.toString() ?? '' })
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
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">🗂️ {p.title}</h1>
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
