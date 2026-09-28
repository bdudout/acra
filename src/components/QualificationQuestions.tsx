'use client'

import { useMemo } from 'react'
import {
  effectiveQualificationQuestions,
  EMPTY_QUALIFICATION_CONFIG,
  type EffectiveQualQuestion,
  type QualificationAnswers,
  type QualificationConfig,
} from '@/lib/qualification'

type Labels = {
  questions: Record<string, string>
  criticiteOptions: Record<string, string>
  statutOptions: Record<string, string>
  yes: string
  no: string
}

type Props = {
  answers: QualificationAnswers
  onChange: (answers: QualificationAnswers) => void
  config?: QualificationConfig | null
  labels: Labels
}

/** Questions réutilisables lors de la création et dans les ateliers.
 * Les valeurs restent dans le parent : aucune réponse n'est persistée avant
 * la validation explicite de la création de l'analyse. */
export default function QualificationQuestions({ answers, onChange, config = null, labels }: Props) {
  const cfg = config ?? EMPTY_QUALIFICATION_CONFIG
  const questions = useMemo(() => effectiveQualificationQuestions(cfg), [cfg])
  const customById = useMemo(() => new Map(cfg.custom.map(question => [question.id, question])), [cfg])

  const questionLabel = (question: EffectiveQualQuestion) =>
    question.builtin ? (cfg.overrides[question.id]?.label || labels.questions[question.id] || question.id) : (customById.get(question.id)?.label || question.id)
  const optionLabel = (question: EffectiveQualQuestion, value: string) => {
    if (!question.builtin) return customById.get(question.id)?.options?.find(option => option.value === value)?.label ?? value
    return (question.id === 'statutReglementaire' ? labels.statutOptions : labels.criticiteOptions)[value] ?? value
  }
  const setAnswer = (id: string, value: boolean | string) => onChange({ ...answers, [id]: value })

  return <div className="space-y-4">
    {questions.map(question => <div key={question.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-gray-700 dark:text-slate-200 sm:max-w-[60%]">{questionLabel(question)}</span>
      {question.type === 'bool' ? <div className="flex gap-2">
        {[true, false].map(value => <button key={String(value)} type="button" onClick={() => setAnswer(question.id, value)} className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${answers[question.id] === value ? 'border-ebios-600 bg-ebios-600 text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'}`}>{value ? labels.yes : labels.no}</button>)}
      </div> : <div className="flex flex-wrap gap-2">
        {(question.options ?? []).map(option => <button key={option.value} type="button" onClick={() => setAnswer(question.id, option.value)} className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${answers[question.id] === option.value ? 'border-ebios-600 bg-ebios-600 text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'}`}>{optionLabel(question, option.value)}</button>)}
      </div>}
    </div>)}
  </div>
}
