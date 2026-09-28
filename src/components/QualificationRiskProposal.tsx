'use client'

// ─── Proposition des risques issus de la qualification ───────────────────────
// Étape explicite entre la qualification et la création de risques : chaque
// risque est présenté avec sa catégorie, sa cotation et son traitement par défaut.
// Un risque IMPOSÉ par l'organisation est coché et verrouillé (non décochable).
// Modal par défaut ; `inline` pour l'intégrer dans une page (atelier 5 EBIOS RM).

import { useState } from 'react'
import { Lock } from 'lucide-react'
import type { QualificationRiskRule } from '@/lib/qualification'

export type ProposedRisk = {
  id: string; title: string; description?: string; mandatory: boolean
  category: QualificationRiskRule['risk']['category']; gravity: number; likelihood: number
  strategy: QualificationRiskRule['risk']['strategy']
}
export type ProposalLabels = {
  title: string; explanation: string; confirm: string; cancel: string
  gravity: string; likelihood: string; strategy: string; mandatory: string; mandatoryHint: string
  categories: Record<string, string>
}

export default function QualificationRiskProposal({ risks, labels, strategies, onConfirm, onCancel, inline = false, busy = false, error }: {
  risks: ProposedRisk[]; labels: ProposalLabels; strategies: Record<string, string>
  onConfirm: (ids: string[]) => void; onCancel?: () => void; inline?: boolean; busy?: boolean; error?: string | null
}) {
  const [selected, setSelected] = useState(() => new Set(risks.map(risk => risk.id)))
  function toggle(risk: ProposedRisk) {
    if (risk.mandatory) return
    setSelected(previous => { const next = new Set(previous); if (next.has(risk.id)) next.delete(risk.id); else next.add(risk.id); return next })
  }
  // Les imposés sont toujours envoyés, quel que soit l'état de la sélection.
  const chosen = () => risks.filter(r => r.mandatory || selected.has(r.id)).map(r => r.id)

  const body = (
    <section className={`card w-full ${inline ? 'p-4' : 'max-w-2xl p-5'} dark:bg-slate-900`} aria-label={inline ? labels.title : undefined}>
      <h2 className="text-lg font-bold text-gray-900 dark:text-slate-50">{labels.title}</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{labels.explanation}</p>
      <div className="mt-4 space-y-2">
        {risks.map(risk => {
          const checked = risk.mandatory || selected.has(risk.id)
          return (
            <label key={risk.id} className={`flex gap-3 rounded-lg border p-3 ${risk.mandatory ? 'border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/20' : 'cursor-pointer border-gray-200 dark:border-slate-700'}`}>
              <input aria-label={risk.title} type="checkbox" checked={checked} disabled={risk.mandatory || busy} onChange={() => toggle(risk)} />
              <span className="min-w-0">
                <span className="font-medium text-gray-900 dark:text-slate-50">{risk.title}</span>
                {risk.mandatory && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200" title={labels.mandatoryHint}>
                    <Lock size={11} aria-hidden="true" />{labels.mandatory}
                  </span>
                )}
                {risk.description && <span className="mt-1 block text-sm text-gray-600 dark:text-slate-300">{risk.description}</span>}
                <span className="mt-1 block text-xs text-gray-500 dark:text-slate-400">
                  {labels.categories[risk.category] ?? risk.category} · {labels.gravity} {risk.gravity}/4 · {labels.likelihood} {risk.likelihood}/4 · {labels.strategy} {strategies[risk.strategy] ?? risk.strategy}
                </span>
                {risk.mandatory && <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">{labels.mandatoryHint}</span>}
              </span>
            </label>
          )
        })}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>{labels.cancel}</button>}
        <button type="button" className="btn-primary" onClick={() => onConfirm(chosen())} disabled={busy}>{labels.confirm}</button>
      </div>
    </section>
  )
  if (inline) return body
  return <div role="dialog" aria-modal="true" aria-label={labels.title} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">{body}</div>
}
