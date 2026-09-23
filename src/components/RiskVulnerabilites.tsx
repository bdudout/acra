'use client'

// ─── Vulnérabilités d'un risque (saisie directe ISO 27005) ───────────────────
// Panneau compact (déplié sous un risque, phase d'identification) : liste simple des
// vulnérabilités exploitées (menace × VULNÉRABILITÉ × bien). Persistées dans le champ
// Json `vulnerabilites` du risque via un PATCH de la LISTE COMPLÈTE (remplacement).

import { useState } from 'react'
import { Plus, Trash2, ShieldAlert } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

interface Vuln { description: string }

export default function RiskVulnerabilites({ analyseId, riskId, editable, initial }: {
  analyseId: string; riskId: string; editable: boolean; initial?: Vuln[]
}) {
  const { t } = useTranslation()
  const m = t.risquesDirects
  const [rows, setRows] = useState<Vuln[]>(Array.isArray(initial) ? initial : [])
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)

  // Persiste la LISTE COMPLÈTE (le champ vulnerabilites est remplacé côté serveur).
  async function persist(next: Vuln[]) {
    setBusy(true)
    const res = await fetch(`/api/analyses/${analyseId}/risques/${riskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vulnerabilites: next }),
    }).catch(() => null)
    setBusy(false)
    return !!(res && res.ok)
  }

  async function ajouter() {
    const description = desc.trim()
    if (!description || busy) return
    const next = [...rows, { description }]
    setRows(next); setDesc('')
    if (!(await persist(next))) setRows(rows) // rollback si échec
  }

  async function supprimer(i: number) {
    const next = rows.filter((_, idx) => idx !== i)
    setRows(next)
    if (!(await persist(next))) setRows(rows)
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
        <ShieldAlert size={14} aria-hidden="true" />{m.vulnTitle}
      </p>
      {rows.length === 0
        ? <p className="text-xs text-gray-400 italic mb-2">{m.vulnEmpty}</p>
        : (
          <ul className="mb-2 space-y-1">
            {rows.map((v, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
                <span className="text-amber-500">›</span>
                <span className="flex-1">{v.description}</span>
                {editable && <button onClick={() => supprimer(i)} className="text-gray-400 hover:text-red-600 p-0.5" aria-label={m.delete}><Trash2 size={13} aria-hidden="true" /></button>}
              </li>
            ))}
          </ul>
        )}
      {editable && (
        <div className="flex flex-wrap items-end gap-2">
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder={m.vulnPlaceholder}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ajouter() } }}
            className="flex-1 min-w-[12rem] px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-xs" />
          <button onClick={ajouter} disabled={busy || !desc.trim()} className="btn-primary text-xs inline-flex items-center gap-1 disabled:opacity-50">
            <Plus size={13} aria-hidden="true" />{m.add}
          </button>
        </div>
      )}
      <p className="mt-1.5 text-[10px] text-gray-400">{m.vulnHint}</p>
    </div>
  )
}
