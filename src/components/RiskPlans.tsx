'use client'

// ─── Plans d'action rattachés à un risque (saisie directe ISO 27005 / 31000) ──
// Panneau compact (déplié sous un risque, phase de traitement) : liste les PLANS
// D'ACTION (objet PlanAction unifié, visible dans /plans-actions) qui réduiront le
// risque actuel → résiduel. Consomme /api/analyses/[id]/risques/[riskId]/plans.

import { useEffect, useState } from 'react'
import { Plus, Trash2, ListChecks } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

interface PlanRow { id: string; titre: string; statut: string; priorite: string; echeance?: string | null; porteur?: string | null }
const PLAN_STATUTS = ['A_FAIRE', 'EN_COURS', 'FAIT'] as const
const PLAN_PRIORITES = ['CRITIQUE', 'MAJEUR', 'MODERE'] as const

export default function RiskPlans({ analyseId, riskId, editable }: { analyseId: string; riskId: string; editable: boolean }) {
  const { t } = useTranslation()
  const m = t.risquesDirects
  const statutLabel = (s: string) => (m.plansStatuts as Record<string, string>)[s] ?? s
  const prioriteLabel = (p: string) => (m.plansPriorites as Record<string, string>)[p] ?? p
  const [rows, setRows] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [titre, setTitre] = useState('')
  const [statut, setStatut] = useState<string>('A_FAIRE')
  const [priorite, setPriorite] = useState<string>('MAJEUR')
  const [echeance, setEcheance] = useState('')
  const [busy, setBusy] = useState(false)
  const base = `/api/analyses/${analyseId}/risques/${riskId}/plans`

  async function reload() {
    const d = await fetch(base).then(r => r.ok ? r.json() : { plans: [] }).catch(() => ({ plans: [] }))
    setRows(d.plans ?? []); setLoading(false)
  }
  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function ajouter() {
    if (!titre.trim() || busy) return
    setBusy(true)
    const res = await fetch(base, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titre, statut, priorite, ...(echeance ? { echeance } : {}) }),
    }).catch(() => null)
    setBusy(false)
    if (res && res.ok) { setTitre(''); setStatut('A_FAIRE'); setPriorite('MAJEUR'); setEcheance(''); reload() }
  }

  async function majStatut(planId: string, s: string) {
    setRows(prev => prev.map(r => r.id === planId ? { ...r, statut: s } : r))
    await fetch(`${base}/${planId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statut: s }),
    }).catch(() => null)
  }

  async function supprimer(planId: string) {
    const res = await fetch(`${base}/${planId}`, { method: 'DELETE' }).catch(() => null)
    if (res && res.ok) setRows(prev => prev.filter(r => r.id !== planId))
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
        <ListChecks size={14} aria-hidden="true" />{m.plansTitle}
      </p>
      {loading ? <p className="text-xs text-gray-400">…</p>
        : rows.length === 0 ? <p className="text-xs text-gray-400 italic mb-2">{m.plansEmpty}</p>
        : (
          <ul className="mb-2 space-y-1">
            {rows.map(r => (
              <li key={r.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
                <span className="text-ebios-500">›</span>
                <span className="flex-1">{r.titre}</span>
                {r.echeance && <span className="text-gray-400 tabular-nums">{r.echeance.slice(0, 10)}</span>}
                {editable
                  ? <select value={r.statut} onChange={e => majStatut(r.id, e.target.value)} aria-label={m.plansStatut}
                      className="px-1.5 py-0.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-[10px]">
                      {PLAN_STATUTS.map(s => <option key={s} value={s}>{statutLabel(s)}</option>)}
                    </select>
                  : <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200">{statutLabel(r.statut)}</span>}
                {editable && <button onClick={() => supprimer(r.id)} className="text-gray-400 hover:text-red-600 p-0.5" aria-label={m.delete}><Trash2 size={13} aria-hidden="true" /></button>}
              </li>
            ))}
          </ul>
        )}
      {editable && (
        <div className="flex flex-wrap items-end gap-2">
          <input value={titre} onChange={e => setTitre(e.target.value)} placeholder={m.plansTitrePlaceholder}
            className="flex-1 min-w-[10rem] px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-xs" />
          <label className="text-[10px] text-gray-500 dark:text-gray-400">{m.plansStatut}
            <select value={statut} onChange={e => setStatut(e.target.value)} className="block mt-0.5 px-1.5 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-xs">
              {PLAN_STATUTS.map(s => <option key={s} value={s}>{statutLabel(s)}</option>)}
            </select>
          </label>
          <label className="text-[10px] text-gray-500 dark:text-gray-400">{m.plansPriorite}
            <select value={priorite} onChange={e => setPriorite(e.target.value)} className="block mt-0.5 px-1.5 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-xs">
              {PLAN_PRIORITES.map(p => <option key={p} value={p}>{prioriteLabel(p)}</option>)}
            </select>
          </label>
          <label className="text-[10px] text-gray-500 dark:text-gray-400">{m.plansEcheance}
            <input type="date" value={echeance} onChange={e => setEcheance(e.target.value)} className="block mt-0.5 px-1.5 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-xs" />
          </label>
          <button onClick={ajouter} disabled={busy || !titre.trim()} className="btn-primary text-xs inline-flex items-center gap-1 disabled:opacity-50">
            <Plus size={13} aria-hidden="true" />{m.add}
          </button>
        </div>
      )}
    </div>
  )
}
