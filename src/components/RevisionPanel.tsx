'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { CYCLES_REVISION, type CycleRevision } from '@/lib/version-analyse'
import { formatDate } from '@/lib/format'

interface Revision {
  id: string
  version: string
  cycle: CycleRevision
  note: string | null
  ateliers: number[]
  createdAt: string
}

/**
 * Suivi des versions x.y d'une analyse (label EBIOS RM §3.4) : version courante,
 * enregistrement d'une révision (cycle opérationnel/stratégique + note + ateliers
 * concernés) et synthèse des révisions successives.
 */
export default function RevisionPanel({ analyseId, initialVersion, canRevise }: {
  analyseId: string
  initialVersion: string
  canRevise: boolean
}) {
  const { t, locale } = useTranslation()
  const tr = t.revisions
  const [version, setVersion] = useState(initialVersion)
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cycle, setCycle] = useState<CycleRevision>('OPERATIONNEL')
  const [note, setNote] = useState('')
  const [ateliers, setAteliers] = useState<number[]>([])

  useEffect(() => {
    fetch(`/api/analyses/${analyseId}/revisions`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setVersion(d.version); setRevisions(d.revisions ?? []) } })
      .catch(() => {})
  }, [analyseId])

  function toggleAtelier(n: number) {
    setAteliers(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n].sort((a, b) => a - b))
  }

  async function submit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/analyses/${analyseId}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle, note, ateliers }),
      })
      if (res.ok) {
        const d = await res.json()
        setVersion(d.version)
        setRevisions(prev => [d.revision, ...prev])
        setOpen(false)
        setNote(''); setAteliers([]); setCycle('OPERATIONNEL')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-800">{tr.title}</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-mono font-medium">v{version}</span>
        </div>
        {canRevise && (
          <button type="button" onClick={() => setOpen(o => !o)} className="btn-secondary text-sm">
            {tr.newRevision}
          </button>
        )}
      </div>

      {open && canRevise && (
        <div className="mt-4 border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
          <div>
            <label className="label">{tr.cycle}</label>
            <div className="flex flex-col gap-1.5 mt-1">
              {CYCLES_REVISION.map(c => (
                <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="cycle" checked={cycle === c} onChange={() => setCycle(c)} />
                  <span>{tr.cycleLabels[c]}</span>
                  <span className="text-xs text-gray-400">{c === 'STRATEGIQUE' ? tr.cycleStrategiqueHint : tr.cycleOperationnelHint}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">{tr.ateliers}</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => toggleAtelier(n)} aria-pressed={ateliers.includes(n)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${ateliers.includes(n) ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                  {tr.atelier} {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">{tr.note}</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              className="input resize-none text-sm" placeholder={tr.notePh} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-sm">{tr.cancel}</button>
            <button type="button" onClick={submit} disabled={saving} className="btn-primary text-sm">
              {saving ? tr.saving : tr.save}
            </button>
          </div>
        </div>
      )}

      {revisions.length > 0 ? (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">{tr.historyTitle}</h4>
          <ul className="space-y-2">
            {revisions.map(r => (
              <li key={r.id} className="text-sm border-l-2 border-indigo-200 pl-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-medium text-indigo-700">v{r.version}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${r.cycle === 'STRATEGIQUE' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>{tr.cycleLabels[r.cycle]}</span>
                  <span className="text-xs text-gray-400">{formatDate(r.createdAt, locale)}</span>
                  {r.ateliers?.length > 0 && (
                    <span className="text-xs text-gray-500">{tr.ateliers} : {r.ateliers.join(', ')}</span>
                  )}
                </div>
                {r.note && <p className="text-gray-600 mt-0.5">{r.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-gray-400 mt-3">{tr.empty}</p>
      )}
    </div>
  )
}
