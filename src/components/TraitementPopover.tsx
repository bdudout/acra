'use client'

// Popover de création / rattachement d'un TRAITEMENT réel (plan d'action,
// dérogation, acceptation de risque) pour un contrôle de conformité, au niveau
// du socle d'organisation. Crée un ConformiteTraitement (multi-exigences via
// `refs`) ou rattache le contrôle à un traitement existant du même type.

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { entryTagForType, type TraitementType } from '@/lib/conformite-traitement'
import type { ConformiteTraitement as EntryTag } from '@/lib/conformite'

export interface ExistingTraitement { id: string; type: string; intitule: string; refs: string[] }

export default function TraitementPopover({ orgId, referentiel, entite, controlRef, controlNom, type, existing, onApplied, onClose }: {
  orgId: string
  referentiel: string
  entite: string
  controlRef: string
  controlNom: string
  type: TraitementType
  existing: ExistingTraitement[]
  onApplied: (tag: EntryTag) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const u = t.conformite.traitementUI
  const typeLabel = (t.conformite.traitements as Record<string, string>)[entryTagForType(type)] ?? type
  const sameType = existing.filter(x => x.type === type)

  const [tab, setTab] = useState<'create' | 'attach'>(sameType.length > 0 ? 'attach' : 'create')
  const [intitule, setIntitule] = useState(`${typeLabel} — ${controlRef}`)
  const [responsable, setResponsable] = useState('')
  const [echeance, setEcheance] = useState('')
  const [description, setDescription] = useState('')
  const [maintien, setMaintien] = useState(false)
  const [niveau, setNiveau] = useState('')
  const [attachId, setAttachId] = useState(sameType[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const base = `/api/organizations/${orgId}/conformite/traitements`

  async function creer() {
    if (!intitule.trim()) return
    setBusy(true); setError(null)
    const res = await fetch(base, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referentiel, entite, type, intitule: intitule.trim(), description, responsable, echeance,
        refs: [controlRef],
        ...(type === 'ACCEPTATION_RISQUE' ? { niveauRisqueMaintenu: maintien, niveauRisque: niveau } : {}),
      }),
    })
    setBusy(false)
    if (!res.ok) { setError(u.error); return }
    onApplied(entryTagForType(type))
  }

  async function rattacher() {
    if (!attachId) return
    setBusy(true); setError(null)
    const res = await fetch(`${base}/${attachId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addRef: controlRef }),
    })
    setBusy(false)
    if (!res.ok) { setError(u.error); return }
    onApplied(entryTagForType(type))
  }

  const inputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100'

  return (
    <div className="mt-2 p-3 rounded-lg border border-ebios-200 bg-ebios-50/60 dark:border-ebios-500/30 dark:bg-ebios-500/10 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ebios-800 dark:text-ebios-200">{typeLabel} · {controlRef}</span>
        <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
      </div>

      <div className="flex gap-1 text-[11px]">
        {(['create', 'attach'] as const).map(k => (
          <button key={k} type="button" onClick={() => setTab(k)}
            disabled={k === 'attach' && sameType.length === 0}
            className={`px-2 py-0.5 rounded-full border ${tab === k ? 'bg-ebios-600 text-white border-ebios-600' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-300 dark:border-gray-600'} disabled:opacity-40`}>
            {k === 'create' ? u.createTab : u.attachTab}
          </button>
        ))}
      </div>

      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}

      {tab === 'create' ? (
        <div className="space-y-1.5">
          <input value={intitule} onChange={e => setIntitule(e.target.value)} placeholder={u.intitulePh} className={inputCls} />
          <div className="flex gap-1.5">
            <input value={responsable} onChange={e => setResponsable(e.target.value)} placeholder={u.responsable} className={inputCls} />
            <input type="date" value={echeance} onChange={e => setEcheance(e.target.value)} title={u.echeance} className={inputCls} />
          </div>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={u.descriptionLabel} rows={2} className={inputCls} />
          {type === 'ACCEPTATION_RISQUE' && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={maintien} onChange={e => setMaintien(e.target.checked)} /> {u.niveauRisqueMaintenu}
              </label>
              <input value={niveau} onChange={e => setNiveau(e.target.value)} placeholder={u.niveauRisquePh} className={`${inputCls} flex-1 min-w-[8rem]`} />
            </div>
          )}
          <div className="flex gap-2 pt-0.5">
            <button type="button" disabled={busy || !intitule.trim()} onClick={creer}
              className="text-xs px-3 py-1 rounded bg-ebios-600 text-white font-medium disabled:opacity-50">{busy ? u.creating : u.create}</button>
            <button type="button" onClick={onClose} className="text-xs px-2.5 py-1 rounded text-gray-500 hover:text-gray-700">{u.cancel}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sameType.length === 0 ? (
            <p className="text-[11px] text-gray-500">{u.attachEmpty}</p>
          ) : (
            <>
              <select value={attachId} onChange={e => setAttachId(e.target.value)} className={inputCls}>
                {sameType.map(x => (
                  <option key={x.id} value={x.id}>{x.intitule} · {u.covers.replace('{n}', String(x.refs.length))}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button type="button" disabled={busy || !attachId} onClick={rattacher}
                  className="text-xs px-3 py-1 rounded bg-ebios-600 text-white font-medium disabled:opacity-50">{u.attachBtn}</button>
                <button type="button" onClick={onClose} className="text-xs px-2.5 py-1 rounded text-gray-500 hover:text-gray-700">{u.cancel}</button>
              </div>
            </>
          )}
        </div>
      )}
      <p className="text-[10px] text-gray-400 truncate">{controlNom}</p>
    </div>
  )
}
