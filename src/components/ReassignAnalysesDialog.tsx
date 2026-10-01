'use client'

import { useEffect, useRef, useState } from 'react'
import { UserCog } from 'lucide-react'

export interface ReassignLabels {
  title: string
  message: string
  toLabel: string
  choose: string
  noCandidate: string
  confirm: string
  cancel: string
}

interface Props {
  candidates: { id: string; label: string }[]
  labels: ReassignLabels
  busy?: boolean
  onConfirm: (toUserId: string) => void
  onCancel: () => void
}

/**
 * Choix du successeur avant suppression d'un compte propriétaire d'analyses
 * (audit 2026-10-01, T2 : une analyse ne disparaît plus avec son auteur).
 * Dialog accessible : role="dialog", aria-modal, fermeture par Échap, focus initial sur la liste.
 */
export default function ReassignAnalysesDialog({ candidates, labels, busy, onConfirm, onCancel }: Props) {
  const [to, setTo] = useState('')
  const selectRef = useRef<HTMLSelectElement>(null)

  useEffect(() => { selectRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="reassign-dialog-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 id="reassign-dialog-title" className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <UserCog size={20} aria-hidden="true" /> {labels.title}
        </h2>
        <p className="mt-2 text-sm text-gray-600">{labels.message}</p>
        {candidates.length === 0 ? (
          <p role="alert" className="mt-4 text-sm text-amber-700">{labels.noCandidate}</p>
        ) : (
          <label className="mt-4 block text-sm text-gray-700">
            <span className="label">{labels.toLabel}</span>
            <select ref={selectRef} className="input w-full" value={to} onChange={e => setTo(e.target.value)}>
              <option value="">{labels.choose}</option>
              {candidates.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>{labels.cancel}</button>
          <button type="button" className="btn-primary disabled:opacity-50" disabled={!to || busy} onClick={() => onConfirm(to)}>{labels.confirm}</button>
        </div>
      </div>
    </div>
  )
}
