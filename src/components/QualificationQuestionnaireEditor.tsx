'use client'

// Éditeur du questionnaire de qualification (ADMIN, /configuration). Permet de
// RENOMMER / DÉSACTIVER les questions natives (sans changer leur id → le moteur
// d'orientations reste intact) et d'AJOUTER des questions personnalisées
// (informatives). Enregistre via PUT /api/admin/organization-config.

import { useState } from 'react'
import { Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import type { QualificationConfig, CustomQualQuestion } from '@/lib/qualification'

interface Props {
  initial: QualificationConfig
  /** Questions natives (id + libellé par défaut i18n), dans l'ordre. */
  builtins: { id: string; label: string }[]
}

export default function QualificationQuestionnaireEditor({ initial, builtins }: Props) {
  const { t } = useTranslation()
  const e = t.qualifEditor
  const [overrides, setOverrides] = useState<Record<string, { label?: string; enabled?: boolean }>>(initial.overrides ?? {})
  const [custom, setCustom] = useState<CustomQualQuestion[]>(initial.custom ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [nLabel, setNLabel] = useState('')
  const [nType, setNType] = useState<'bool' | 'choice'>('bool')
  const [nOpts, setNOpts] = useState('')

  const dirty = () => setSaved(false)
  function setOverride(id: string, patch: { label?: string; enabled?: boolean }) {
    setOverrides(o => ({ ...o, [id]: { ...o[id], ...patch } })); dirty()
  }
  function addCustom() {
    if (!nLabel.trim()) return
    const cq: CustomQualQuestion = { id: '', label: nLabel.trim(), type: nType }
    if (nType === 'choice') cq.options = nOpts.split(/[,\n]/).map(s => s.trim()).filter(Boolean).map(l => ({ value: l, label: l }))
    setCustom(c => [...c, cq]); setNLabel(''); setNOpts(''); setNType('bool'); dirty()
  }
  function removeCustom(i: number) { setCustom(c => c.filter((_, j) => j !== i)); dirty() }
  function setCustomLabel(i: number, label: string) { setCustom(c => c.map((x, j) => j === i ? { ...x, label } : x)); dirty() }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/organization-config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qualificationQuestionnaire: { overrides, custom } }),
    })
    setSaving(false)
    if (res.ok) { const d = await res.json().catch(() => null); if (d?.qualificationQuestionnaire) { setOverrides(d.qualificationQuestionnaire.overrides ?? {}); setCustom(d.qualificationQuestionnaire.custom ?? []) } setSaved(true) }
  }

  const inp = 'px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-900'

  return (
    <div className="space-y-5">
      {/* Questions natives : renommer / désactiver */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">{e.builtinTitle}</p>
        <div className="space-y-1.5">
          {builtins.map(b => {
            const ov = overrides[b.id] ?? {}
            const enabled = ov.enabled !== false
            return (
              <div key={b.id} className="flex items-center gap-2">
                <input type="checkbox" checked={enabled} onChange={ev => setOverride(b.id, { enabled: ev.target.checked })} title={e.enabledHint} />
                <input className={`${inp} flex-1 ${enabled ? '' : 'opacity-50'}`} value={ov.label ?? ''} placeholder={b.label}
                  disabled={!enabled} onChange={ev => setOverride(b.id, { label: ev.target.value })} />
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-1">{e.builtinHint}</p>
      </div>

      {/* Questions personnalisées */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">{e.customTitle}</p>
        {custom.length === 0 ? <p className="text-xs text-gray-400 mb-2">{e.customEmpty}</p> : (
          <div className="space-y-1.5 mb-2">
            {custom.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={`${inp} flex-1`} value={c.label} onChange={ev => setCustomLabel(i, ev.target.value)} />
                <span className="text-[11px] text-gray-400 w-16">{c.type === 'choice' ? e.typeChoice : e.typeBool}</span>
                <button onClick={() => removeCustom(i)} className="text-gray-400 hover:text-red-600 p-1" aria-label={t.delete}><Trash2 size={14} aria-hidden="true" /></button>
              </div>
            ))}
          </div>
        )}
        {/* Ajout */}
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <label className="flex flex-col gap-1 text-xs text-gray-500 flex-1 min-w-[12rem]">
            <span>{e.newLabel}</span>
            <input className={inp} value={nLabel} onChange={ev => setNLabel(ev.target.value)} placeholder={e.newLabelPh} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            <span>{e.newType}</span>
            <select className={inp} value={nType} onChange={ev => setNType(ev.target.value as 'bool' | 'choice')}>
              <option value="bool">{e.typeBool}</option>
              <option value="choice">{e.typeChoice}</option>
            </select>
          </label>
          {nType === 'choice' && (
            <label className="flex flex-col gap-1 text-xs text-gray-500 flex-1 min-w-[12rem]">
              <span>{e.newOptions}</span>
              <input className={inp} value={nOpts} onChange={ev => setNOpts(ev.target.value)} placeholder={e.newOptionsPh} />
            </label>
          )}
          <button onClick={addCustom} disabled={!nLabel.trim()} className="btn-secondary text-sm inline-flex items-center gap-1 disabled:opacity-50">
            <Plus size={14} aria-hidden="true" /> {e.add}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-50">{saving ? t.saving : t.save}</button>
        {saved && <span className="text-sm text-green-600 inline-flex items-center gap-1"><CheckCircle2 size={15} aria-hidden="true" /> {e.saved}</span>}
      </div>
    </div>
  )
}
