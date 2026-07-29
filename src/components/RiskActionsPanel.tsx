'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { RISK_ACTION_STATUTS } from '@/lib/risk-action'

export interface ActionsSummary {
  total: number; faits: number; enCours: number; aFaire: number; enRetard: number; tauxAvancement: number
}
interface Action {
  id: string; intitule: string; description: string | null; responsable: string | null
  echeance: string | null; statut: string; statutEffectif: string
}
type Form = { intitule: string; responsable: string; echeance: string; statut: string }
const EMPTY: Form = { intitule: '', responsable: '', echeance: '', statut: 'A_FAIRE' }

const STATUT_BADGE: Record<string, string> = {
  A_FAIRE: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  EN_COURS: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  FAIT: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  EN_RETARD: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
}

// Plan d'action d'un risque du registre : liste + création/édition inline.
// `onChange` remonte au parent pour rafraîchir la synthèse d'avancement.
export default function RiskActionsPanel({ riskId, canEdit, onChange }: { riskId: string; canEdit: boolean; onChange: () => void }) {
  const { t } = useTranslation()
  const a = t.riskActions
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Form>(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    const d = await fetch(`/api/risk-items/${riskId}/actions`).then(x => x.ok ? x.json() : { actions: [] })
    setActions(d.actions ?? []); setLoading(false)
  }
  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function err(code: string) { return (a.errors as Record<string, string>)[code] ?? code }

  async function submit() {
    if (!form.intitule.trim()) { setError(err('intitule_requis')); return }
    setBusy(true); setError(null)
    const payload = { intitule: form.intitule, responsable: form.responsable || null, echeance: form.echeance || null, statut: form.statut }
    const res = await fetch(editId ? `/api/risk-items/${riskId}/actions/${editId}` : `/api/risk-items/${riskId}/actions`, {
      method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    setForm(EMPTY); setEditId(null); setShowForm(false); reload(); onChange()
  }
  function startEdit(x: Action) {
    setEditId(x.id); setShowForm(true); setError(null)
    setForm({ intitule: x.intitule, responsable: x.responsable ?? '', echeance: x.echeance ? x.echeance.slice(0, 10) : '', statut: x.statut })
  }
  async function remove(id: string) {
    if (!confirm(a.confirmDelete)) return
    await fetch(`/api/risk-items/${riskId}/actions/${id}`, { method: 'DELETE' }); reload(); onChange()
  }

  const inp = 'px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{a.title}</p>
        {canEdit && !showForm && <button onClick={() => { setForm(EMPTY); setEditId(null); setShowForm(true) }} className="btn-secondary text-xs">{a.addBtn}</button>}
      </div>

      {canEdit && showForm && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-3 space-y-2">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <input value={form.intitule} onChange={e => setForm(f => ({ ...f, intitule: e.target.value }))} placeholder={a.intitulePlaceholder} className={`${inp} w-full`} />
          <div className="flex flex-wrap gap-2 items-center">
            <input value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} placeholder={a.responsablePlaceholder} className={inp} />
            <input type="date" value={form.echeance} onChange={e => setForm(f => ({ ...f, echeance: e.target.value }))} className={inp} aria-label={a.echeance} />
            <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))} className={inp}>
              {RISK_ACTION_STATUTS.map(s => <option key={s} value={s}>{(a.statuts as Record<string, string>)[s] ?? s}</option>)}
            </select>
            <button onClick={submit} disabled={busy} className="btn-primary text-xs disabled:opacity-50">{editId ? a.save : a.add}</button>
            <button onClick={() => { setShowForm(false); setEditId(null); setError(null) }} className="text-xs text-gray-500 hover:text-gray-700">{a.cancel}</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-xs text-gray-400">…</p>
        : actions.length === 0 ? <p className="text-xs text-gray-400 italic">{a.empty}</p>
        : (
          <ul className="space-y-1.5">
            {actions.map(x => (
              <li key={x.id} className="flex items-center gap-3 text-sm">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUT_BADGE[x.statutEffectif] ?? STATUT_BADGE.A_FAIRE}`}>{(a.statuts as Record<string, string>)[x.statutEffectif] ?? x.statutEffectif}</span>
                <span className="flex-1 text-gray-700 dark:text-gray-200 truncate">{x.intitule}</span>
                {x.responsable && <span className="text-xs text-gray-400">{x.responsable}</span>}
                {x.echeance && <span className="text-xs text-gray-400">{x.echeance.slice(0, 10)}</span>}
                {canEdit && <>
                  <button onClick={() => startEdit(x)} className="text-xs text-ebios-600 hover:underline">{a.edit}</button>
                  <button onClick={() => remove(x.id)} className="text-xs text-red-500 hover:underline">{a.delete}</button>
                </>}
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}
