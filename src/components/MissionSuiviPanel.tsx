'use client'

// ─── Suivi d'une mission d'audit : notation, jalons du cycle, indépendance ───

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { JALONS, NOTATION_MIN, NOTATION_MAX } from '@/lib/audit-l4'

export interface MissionSuiviData { id: string; notation: number | null; jalons: Record<string, string>; independance: Record<string, unknown> }
const inp = 'px-2 py-1 rounded-sm border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-xs'

export default function MissionSuiviPanel({ mission, canWrite, busy, onSave, onIndependance }: {
  mission: MissionSuiviData; canWrite: boolean; busy: boolean
  onSave: (v: { notation: number | null; jalons: Record<string, string> }) => void
  onIndependance: (v: { conflit: boolean; commentaire?: string }) => void
}) {
  const { t, locale } = useTranslation()
  const l = t.auditInterne.l4
  const notes = t.rapports.notations as Record<string, string>
  const [notation, setNotation] = useState(mission.notation ? String(mission.notation) : '')
  const [jalons, setJalons] = useState<Record<string, string>>(Object.fromEntries(Object.entries(mission.jalons ?? {}).map(([k, v]) => [k, String(v).slice(0, 10)])))
  const [conflit, setConflit] = useState(false)
  const [commentaire, setCommentaire] = useState('')
  const ind = mission.independance as { conflit?: boolean; commentaire?: string; declareLe?: string }
  const declaree = typeof ind.declareLe === 'string'
  const labels = l.jalonLabels as Record<string, string>
  const notationLabel = mission.notation ? notes[String(mission.notation)] : l.notationNon

  const statutIndependance = declaree
    ? `${ind.conflit ? l.independanceConflit : l.independanceOk} — ${l.declareLe} ${new Date(ind.declareLe as string).toLocaleDateString(locale)}${ind.commentaire ? ` — ${ind.commentaire}` : ''}`
    : l.independanceNon

  if (!canWrite) {
    return (
      <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
        <p><span className="font-medium">{l.notation} :</span> {notationLabel}</p>
        <p><span className="font-medium">{l.independance} :</span> {statutIndependance}</p>
        <ul className="flex flex-wrap gap-x-4">{JALONS.filter(j => mission.jalons?.[j]).map(j => <li key={j}>{labels[j]} : {new Date(mission.jalons[j]).toLocaleDateString(locale, { timeZone: 'UTC' })}</li>)}</ul>
      </div>
    )
  }
  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-gray-500">{l.notation}
          <select aria-label={l.notation} value={notation} onChange={e => setNotation(e.target.value)} className={`${inp} block mt-1`}>
            <option value="">{l.notationNon}</option>
            {Array.from({ length: NOTATION_MAX - NOTATION_MIN + 1 }, (_, i) => i + NOTATION_MIN).map(n => <option key={n} value={n}>{n} — {notes[String(n)]}</option>)}
          </select>
        </label>
      </div>
      <div>
        <p className="font-semibold text-gray-600 dark:text-gray-300">{l.jalons}</p>
        <p className="text-[11px] text-gray-400">{l.jalonsHint}</p>
        <div className="mt-1 grid gap-2 sm:grid-cols-3">
          {JALONS.map(j => (
            <label key={j} className="text-gray-500">{labels[j]}
              <input type="date" aria-label={labels[j]} value={jalons[j] ?? ''} onChange={e => setJalons(v => ({ ...v, [j]: e.target.value }))} className={`${inp} block mt-1`} />
            </label>
          ))}
        </div>
      </div>
      <button type="button" disabled={busy} onClick={() => onSave({ notation: notation ? Number(notation) : null, jalons: Object.fromEntries(Object.entries(jalons).filter(([, v]) => v)) })} className="btn-secondary text-xs disabled:opacity-50">{t.auditInterne.save}</button>

      <div className="border-t border-gray-100 pt-2 dark:border-gray-700 space-y-1.5">
        <p className={`font-semibold ${declaree ? 'text-gray-600 dark:text-gray-300' : 'text-amber-700 dark:text-amber-300'}`}>{l.independance} — {statutIndependance}</p>
        <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300"><input type="checkbox" aria-label={l.independanceConflit} checked={conflit} onChange={e => setConflit(e.target.checked)} />{l.independanceConflit}</label>
        <label className="block text-gray-500">{l.independanceCommentaire}
          <input aria-label={l.independanceCommentaire} value={commentaire} maxLength={2000} onChange={e => setCommentaire(e.target.value)} className={`${inp} block mt-1 w-full`} />
        </label>
        <button type="button" disabled={busy} onClick={() => { if (conflit && !commentaire.trim()) return; onIndependance({ conflit, ...(commentaire.trim() ? { commentaire: commentaire.trim() } : {}) }) }} className="btn-secondary text-xs disabled:opacity-50">{l.independanceDeclarer}</button>
      </div>
    </div>
  )
}
