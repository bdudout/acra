'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import {
  QUALIFICATION_QUESTIONS,
  deriveOrientations,
  type QualificationAnswers,
} from '@/lib/qualification'

interface Props {
  analyseId: string
  initial?: QualificationAnswers | null
  canEdit?: boolean
}

/**
 * Panneau optionnel de qualification d'une analyse (cf. lib/qualification.ts).
 * Affiché en début d'analyse uniquement si la fonctionnalité est activée
 * (OrganizationConfig.qualificationActive). Sauvegarde via PATCH /api/analyses/[id].
 */
export default function QualificationPanel({ analyseId, initial, canEdit = true }: Props) {
  const { t } = useTranslation()
  const [answers, setAnswers] = useState<QualificationAnswers>(initial ?? {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean>(!!initial && Object.keys(initial ?? {}).length > 0)

  const orientations = useMemo(() => deriveOrientations(answers), [answers])
  const qLabels = t.qualification.questions as Record<string, string>
  const critLabels = t.qualification.criticiteOptions as Record<string, string>
  const oLabels = t.qualification.orientations as Record<string, string>
  const shortLabels = t.qualification.short as Record<string, string>

  // Synthèse des points saillants pour la vue repliée (booléens « Oui » + criticité)
  const summaryChips = useMemo(() => {
    const chips: { key: string; label: string; tone: 'pos' | 'warn' | 'neutral' }[] = []
    for (const q of QUALIFICATION_QUESTIONS) {
      const v = answers[q.id]
      if (q.type === 'bool') {
        if (v === true) chips.push({ key: q.id, label: shortLabels[q.id] ?? q.id, tone: 'pos' })
      } else if (q.type === 'choice' && typeof v === 'string') {
        chips.push({ key: q.id, label: `${shortLabels[q.id] ?? q.id} : ${critLabels[v] ?? v}`, tone: v === 'eleve' ? 'warn' : 'neutral' })
      }
    }
    return chips
  }, [answers]) // eslint-disable-line react-hooks/exhaustive-deps

  const chipClass = (tone: 'pos' | 'warn' | 'neutral') =>
    tone === 'warn' ? 'bg-amber-100 text-amber-800 border-amber-200'
    : tone === 'pos' ? 'bg-ebios-50 text-ebios-700 border-ebios-100'
    : 'bg-gray-100 text-gray-600 border-gray-200'

  function setAnswer(id: string, value: boolean | string) {
    setAnswers(prev => ({ ...prev, [id]: value }))
    setSaved(false)
  }

  async function save() {
    setSaving(true); setSaved(false)
    const res = await fetch(`/api/analyses/${analyseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qualification: answers }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); setCollapsed(true) }
  }

  if (collapsed) {
    return (
      <div className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>🧭</span>
            <span className="text-sm font-medium text-gray-800">{t.qualification.title}</span>
          </div>
          {canEdit && (
            <button onClick={() => setCollapsed(false)} className="text-xs text-ebios-600 hover:text-ebios-800 font-medium hover:underline flex-shrink-0">
              {t.qualification.edit}
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {summaryChips.length === 0 ? (
            <span className="text-xs text-gray-500">{t.qualification.summaryEmpty}</span>
          ) : (
            summaryChips.map(c => (
              <span key={c.key} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${chipClass(c.tone)}`}>{c.label}</span>
            ))
          )}
        </div>
        {orientations.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">{orientations.length} {t.qualification.orientationsTitle.toLowerCase()}</p>
        )}
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-start gap-2 mb-1">
        <span className="text-lg">🧭</span>
        <h2 className="text-base font-semibold text-gray-800">{t.qualification.title}</h2>
      </div>
      <p className="text-sm text-gray-500 mb-5">{t.qualification.intro}</p>

      <div className="space-y-4">
        {QUALIFICATION_QUESTIONS.map(q => (
          <div key={q.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <label className="text-sm text-gray-700 sm:max-w-[60%]">{qLabels[q.id] ?? q.id}</label>
            {q.type === 'bool' ? (
              <div className="flex gap-2">
                {[true, false].map(v => (
                  <button
                    key={String(v)}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setAnswer(q.id, v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      answers[q.id] === v ? 'bg-ebios-600 text-white border-ebios-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {v ? t.qualification.yes : t.qualification.no}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {(q.options ?? []).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setAnswer(q.id, opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      answers[q.id] === opt.value ? 'bg-ebios-600 text-white border-ebios-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {critLabels[opt.value] ?? opt.value}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Orientations dérivées */}
      <div className="mt-6 p-4 rounded-lg bg-ebios-50 border border-ebios-100">
        <p className="text-sm font-semibold text-ebios-800 mb-2">{t.qualification.orientationsTitle}</p>
        {orientations.length === 0 ? (
          <p className="text-sm text-gray-500">{t.qualification.noOrientation}</p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-2">{t.qualification.orientationsIntro}</p>
            <ul className="space-y-1.5">
              {orientations.map(o => (
                <li key={o} className="text-sm text-gray-700 flex gap-2">
                  <span className="text-ebios-600">›</span>
                  <span>{oLabels[o] ?? o}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {canEdit && (
        <div className="mt-5 flex items-center gap-3">
          <button onClick={save} disabled={saving} className="btn-primary text-sm">
            {saving ? '…' : t.qualification.save}
          </button>
          {saved && <span className="text-sm text-green-600">✓ {t.qualification.saved}</span>}
        </div>
      )}
    </div>
  )
}
