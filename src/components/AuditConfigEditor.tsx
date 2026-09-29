'use client'

// ─── Paramétrage de l'audit interne (ADMIN) ──────────────────────────────────
// Rappels automatiques des recommandations et cycles de couverture par cotation de risque.

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import type { AuditConfig } from '@/lib/audit-config'

const inp = 'px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm w-24'

export default function AuditConfigEditor({ onSaved }: { onSaved?: () => void }) {
  const { t } = useTranslation()
  const l = t.auditInterne.l4
  const [cfg, setCfg] = useState<AuditConfig | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/audit/config').then(r => (r.ok ? r.json() : null)).then(j => { if (j?.active) { setCfg(j.config); setCanEdit(!!j.canEdit) } }).catch(() => {})
  }, [])
  if (!cfg || !canEdit) return null

  async function save() {
    setMsg(null)
    const res = await fetch('/api/audit/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    const j = await res.json().catch(() => ({}))
    if (res.ok) { setCfg(j.config); setMsg(l.cfgSaved); onSaved?.() }
  }
  const setCycle = (cot: number, v: string) => setCfg(c => {
    if (!c) return c
    const cycles = { ...c.cycles }
    if (v === '') delete cycles[cot]; else cycles[cot] = Number(v)
    return { ...c, cycles }
  })

  return (
    <section className="card mt-6" aria-labelledby="audit-cfg-title">
      <h2 id="audit-cfg-title" className="font-semibold mb-3">{l.cfgTitle}</h2>
      <label className="flex items-center gap-2 text-sm mb-3">
        <input type="checkbox" checked={cfg.rappelsActifs} onChange={e => setCfg({ ...cfg, rappelsActifs: e.target.checked })} />
        {l.cfgRappels}
      </label>
      <div className="flex flex-wrap gap-4 mb-3">
        <label className="text-sm flex flex-col gap-1">{l.cfgJoursAvant}
          <input type="number" min={1} max={90} className={inp} value={cfg.rappelJoursAvant} onChange={e => setCfg({ ...cfg, rappelJoursAvant: Number(e.target.value) })} />
        </label>
        <label className="text-sm flex flex-col gap-1">{l.cfgRelance}
          <input type="number" min={1} max={90} className={inp} value={cfg.rappelRelanceJours} onChange={e => setCfg({ ...cfg, rappelRelanceJours: Number(e.target.value) })} />
        </label>
      </div>
      <p className="text-sm mb-1">{l.cfgCycles}</p>
      <div className="flex flex-wrap gap-4 mb-3">
        {[4, 3, 2, 1].map(cot => (
          <label key={cot} className="text-sm flex flex-col gap-1">{l.universRisque.replace(/\(.*\)/, '').trim()} {cot}
            <input type="number" min={1} max={10} className={inp} value={cfg.cycles[cot] ?? ''} onChange={e => setCycle(cot, e.target.value)} aria-label={`${l.cfgCycles} — ${cot}`} />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary text-sm" onClick={save}>{l.cfgSave}</button>
        {msg && <span role="status" className="text-xs text-green-700 dark:text-green-300">{msg}</span>}
      </div>
    </section>
  )
}
