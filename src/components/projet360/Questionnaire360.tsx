'use client'

// ─── Questionnaire de qualification 360 (analyse PROJET_360) ─────────────────
// Questions oui/non groupées par domaine (cyber, IT, projet, métier, fraude,
// externalisation), progression par domaine, enregistrement (PUT
// /api/analyses/[id]/qualification-360), puis risques proposés par les réponses
// via le flux commun des risques de qualification (sélection, risques imposés).

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { DOMAINES_360, QUESTIONS_360, progression360 } from '@/lib/projet360'
import { QualificationRisksDialog, useQualificationProposals } from '@/components/QualificationRisksFlow'

export default function Questionnaire360({ analyseId, editable, initialAnswers, sources: initialSources = {}, onRisksCreated }: {
  analyseId: string; editable: boolean; initialAnswers: Record<string, boolean>
  /** Réponses pré-remplies d'après les données existantes : question → source (jusqu'à confirmation). */
  sources?: Record<string, string>
  onRisksCreated?: () => void
}) {
  const { t } = useTranslation()
  const p = t.projet360
  const questions = p.questions as Record<string, string>
  const domaines = p.domaines as Record<string, string>
  const [answers, setAnswers] = useState<Record<string, boolean>>(initialAnswers)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [sources, setSources] = useState(initialSources)
  const sourceLabels = p.prefillSources as Record<string, string>
  const { pending, reload } = useQualificationProposals(analyseId)
  const progression = useMemo(() => progression360(answers), [answers])

  useEffect(() => { reload() }, [reload])

  async function save() {
    setBusy(true); setMsg(null)
    const res = await fetch(`/api/analyses/${analyseId}/qualification-360`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }),
    }).catch(() => null)
    setBusy(false)
    if (!res || !res.ok) { setMsg(p.saveError); return }
    setMsg(p.saved)
    setSources({}) // réponses confirmées : plus de badge « pré-rempli »
    await reload()
  }

  return (
    <section className="card p-6">
      <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{p.qTitle}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">{p.qIntro}</p>
      {Object.keys(sources).length > 0 && <p className="mb-4 rounded-md bg-ebios-50 px-3 py-2 text-xs text-ebios-800 dark:bg-ebios-900/20 dark:text-ebios-200">{p.prefillHint}</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        {DOMAINES_360.map(d => (
          <div key={d} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{domaines[d]}</h3>
              <span className="text-xs tabular-nums text-gray-500">{p.progress.replace('{answered}', String(progression[d].answered)).replace('{total}', String(progression[d].total))}</span>
            </div>
            <ul className="mt-3 space-y-3">
              {QUESTIONS_360.filter(q => q.domaine === d).map(q => {
                const label = questions[q.id.slice('p360.'.length)] ?? q.id
                const v = answers[q.id]
                return (
                  <li key={q.id}>
                    <div role="radiogroup" aria-label={label} className="flex items-start justify-between gap-3">
                      <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
                      <span className="flex shrink-0 gap-3 text-sm">
                        {[true, false].map(val => (
                          <label key={String(val)} className="inline-flex items-center gap-1">
                            <input type="radio" name={q.id} disabled={!editable} checked={v === val}
                              onChange={() => { setAnswers(a => ({ ...a, [q.id]: val })); setMsg(null) }} />
                            {val ? p.yes : p.no}
                          </label>
                        ))}
                      </span>
                    </div>
                    {sources[q.id] && <p className="mt-0.5 text-[11px] text-ebios-700 dark:text-ebios-300"><span className="font-medium">{p.prefillBadge}</span> — {sourceLabels[sources[q.id]] ?? sources[q.id]}</p>}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {editable && <button type="button" disabled={busy} onClick={save} className="btn-primary text-sm disabled:opacity-50">{p.save}</button>}
        {editable && (pending.length > 0
          ? <button type="button" onClick={() => setDialogOpen(true)} className="btn-secondary text-sm">{p.proposalsButton.replace('{n}', String(pending.length))}</button>
          : <span className="text-xs text-gray-500">{p.proposalsNone}</span>)}
        {msg && <span role="status" className="text-xs text-gray-600 dark:text-gray-300">{msg}</span>}
      </div>
      {dialogOpen && (
        <QualificationRisksDialog analyseId={analyseId} risks={pending} onClose={() => setDialogOpen(false)}
          onDone={summary => { setDialogOpen(false); setMsg(summary); reload(); onRisksCreated?.() }} />
      )}
    </section>
  )
}
