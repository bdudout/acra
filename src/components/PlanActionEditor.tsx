'use client'

// Éditeur inline RÉUTILISABLE d'un plan d'action (PlanAction) : titre, porteur,
// échéance, priorité, statut → PATCH /api/organizations/[orgId]/plans-actions/[id].
// Utilisé dans la conformité détaillée (au niveau du contrôle) ET dans /actions
// (action orpheline). Ne touche pas aux liens (rattachements).

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { ACTION_PRIORITES, RISK_ACTION_STATUTS } from '@/lib/risk-action'

export interface PlanActionEditValue {
  id: string
  titre: string
  porteur: string | null
  echeance: string | null // ISO ou null
  priorite: string
  statut: string
}

export default function PlanActionEditor({ orgId, action, onSaved, onCancel }: {
  orgId: string
  action: PlanActionEditValue
  onSaved: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const pa = t.plansActions
  const [titre, setTitre] = useState(action.titre)
  const [porteur, setPorteur] = useState(action.porteur ?? '')
  const [echeance, setEcheance] = useState(action.echeance ? action.echeance.slice(0, 10) : '')
  const [priorite, setPriorite] = useState(action.priorite)
  const [statut, setStatut] = useState(action.statut)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function save() {
    if (!titre.trim()) return
    setBusy(true); setError(false)
    const res = await fetch(`/api/organizations/${orgId}/plans-actions/${action.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titre: titre.trim(), porteur: porteur || null, echeance: echeance || null, priorite, statut }),
    })
    setBusy(false)
    if (!res.ok) { setError(true); return }
    onSaved()
  }

  const inp = 'border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs bg-white dark:bg-gray-800'
  return (
    <div className="mt-2 rounded-lg border border-ebios-200 bg-ebios-50/50 dark:border-ebios-500/30 dark:bg-ebios-500/10 p-2 flex flex-wrap items-end gap-1.5">
      {error && <p className="w-full text-[11px] text-red-600">{pa.editError}</p>}
      <input value={titre} onChange={e => setTitre(e.target.value)} placeholder={pa.colTitre} className={`${inp} flex-1 min-w-[12rem]`} />
      <input value={porteur} onChange={e => setPorteur(e.target.value)} placeholder={pa.colPorteur} className={`${inp} min-w-[8rem]`} />
      <input type="date" value={echeance} onChange={e => setEcheance(e.target.value)} title={pa.colEcheance} className={inp} />
      <select value={priorite} onChange={e => setPriorite(e.target.value)} title={pa.colPriorite} className={inp}>
        {ACTION_PRIORITES.map(p => <option key={p} value={p}>{pa.priorites[p]}</option>)}
      </select>
      <select value={statut} onChange={e => setStatut(e.target.value)} title={pa.colStatut} className={inp}>
        {RISK_ACTION_STATUTS.map(s => <option key={s} value={s}>{pa.statuts[s as keyof typeof pa.statuts] ?? s}</option>)}
      </select>
      <button type="button" disabled={busy || !titre.trim()} onClick={save}
        className="text-xs px-3 py-1.5 rounded bg-ebios-600 text-white font-medium disabled:opacity-50">{pa.save}</button>
      <button type="button" onClick={onCancel} className="text-xs px-2 py-1.5 text-gray-500 hover:text-gray-700">{pa.clear}</button>
    </div>
  )
}
