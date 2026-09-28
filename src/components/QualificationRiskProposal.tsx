'use client'

import { useState } from 'react'
import type { QualificationRiskRule } from '@/lib/qualification'

type Risk = QualificationRiskRule['risk'] & { id: string }
type Labels = { title: string; explanation: string; confirm: string; cancel: string; gravity: string; likelihood: string; strategy: string }

/** Étape explicite entre qualification et création de risques. */
export default function QualificationRiskProposal({ risks, labels, onConfirm, onCancel }: { risks: Risk[]; labels: Labels; onConfirm: (ids: string[]) => void; onCancel: () => void }) {
  const [selected, setSelected] = useState(() => new Set(risks.map(risk => risk.id)))
  function toggle(id: string) { setSelected(previous => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next }) }
  return <div role="dialog" aria-modal="true" aria-label={labels.title} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><section className="card w-full max-w-2xl p-5 dark:bg-slate-900"><h2 className="text-lg font-bold text-gray-900 dark:text-slate-50">{labels.title}</h2><p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{labels.explanation}</p><div className="mt-4 space-y-2">{risks.map(risk => <label key={risk.id} className="flex cursor-pointer gap-3 rounded-lg border border-gray-200 p-3 dark:border-slate-700"><input aria-label={risk.title} type="checkbox" checked={selected.has(risk.id)} onChange={() => toggle(risk.id)} /><span><span className="font-medium text-gray-900 dark:text-slate-50">{risk.title}</span>{risk.description && <span className="mt-1 block text-sm text-gray-600 dark:text-slate-300">{risk.description}</span>}<span className="mt-1 block text-xs text-gray-500">{risk.category} · {labels.gravity} {risk.gravity}/4 · {labels.likelihood} {risk.likelihood}/4 · {labels.strategy} {risk.strategy}</span></span></label>)}</div><div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onCancel}>{labels.cancel}</button><button type="button" className="btn-primary" onClick={() => onConfirm([...selected])}>{labels.confirm}</button></div></section></div>
}
