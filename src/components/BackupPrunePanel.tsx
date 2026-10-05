'use client'

// Libérer de l'espace : suppression des points de restauration au-delà des N plus récents de chaque type. Aperçu (rien n'est
// supprimé), puis confirmation par saisie du nombre de points ; la suppression est une demande que l'agent hôte applique.

import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { formatBytes, type BackupPolicy } from '@/lib/backup-policy'

interface Row { id: string; reason: string; createdAt: string; version: string; sizeBytes: number }
interface Preview { toDelete: Row[]; toKeep: Row[]; reclaimedBytes: number }
interface Props { policy: BackupPolicy; agentAvailable: boolean; onChanged: () => void }
const fill = (s: string, vars: Record<string, string>) => Object.entries(vars).reduce((a, [k, v]) => a.replaceAll(`{${k}}`, v), s)
const clampKeep = (v: number) => Math.min(60, Math.max(1, Number.isFinite(v) ? Math.trunc(v) : 1))

export default function BackupPrunePanel({ policy, agentAvailable, onChanged }: Props) {
  const { t, locale } = useTranslation()
  const p = t.version.prune
  const defaultScheduled = (['daily', 'weekly', 'monthly'] as const).reduce((n, k) => n + (policy[k].enabled ? policy[k].keep : 0), 0) || 3
  const [open, setOpen] = useState(false)
  const [keepScheduled, setKeepScheduled] = useState(clampKeep(defaultScheduled))
  const [keepPreUpdate, setKeepPreUpdate] = useState(3)
  const [keepManual, setKeepManual] = useState(3)
  const [includeManual, setIncludeManual] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const params = { keepScheduled, keepPreUpdate, keepManual, includeManual }
  const errText = (code: unknown, status: number) => (p.errors as Record<string, string>)[String(code)] ?? fill(p.errors.generic, { error: String(code ?? status) })

  const refresh = useCallback(async () => {
    setError(null); setTyped('')
    try {
      const r = await fetch('/api/admin/backup/prune', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ keepScheduled, keepPreUpdate, keepManual, includeManual }) })
      const data = await r.json().catch(() => ({}))
      if (r.ok) setPreview(data as Preview); else { setPreview(null); setError(errText(data.error, r.status)) }
    } catch { setPreview(null); setError(fill(p.errors.generic, { error: '—' })) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keepScheduled, keepPreUpdate, keepManual, includeManual])

  useEffect(() => { if (open) void refresh() }, [open, refresh])

  async function run() {
    if (!preview) return
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/admin/backup/prune', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...params, confirmCount: preview.toDelete.length }) })
      const data = await r.json().catch(() => ({}))
      if (r.ok) { setMessage(p.done); setOpen(false); setPreview(null); onChanged() } else setError(errText(data.error, r.status))
    } catch { setError(fill(p.errors.generic, { error: '—' })) } finally { setBusy(false) }
  }

  const size = (n: number) => formatBytes(n, locale)
  const reasons = p.reasons as Record<string, string>
  const count = preview?.toDelete.length ?? 0
  const num = (label: string, value: number, set: (n: number) => void) => (
    <label className="flex items-center gap-1 text-sm">{label}
      <input type="number" min={1} max={60} className="input w-16" value={value} onChange={e => set(clampKeep(Number.parseInt(e.target.value, 10)))} />
    </label>
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button type="button" className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50" disabled={!agentAvailable} onClick={() => { setMessage(null); setOpen(o => !o) }}>
          <Trash2 size={14} aria-hidden="true" /> {p.open}
        </button>
        {message && <span className="text-sm text-ebios-700">{message}</span>}
      </div>
      {open && (
        <div role="dialog" aria-label={p.open} className="space-y-3 rounded-md border border-gray-200 p-3">
          <p className="text-xs text-gray-500">{p.intro}</p>
          <div className="flex flex-wrap gap-4">
            {num(p.keepScheduled, keepScheduled, setKeepScheduled)}
            {num(p.keepPreUpdate, keepPreUpdate, setKeepPreUpdate)}
            {includeManual && num(p.keepManual, keepManual, setKeepManual)}
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={includeManual} onChange={e => setIncludeManual(e.target.checked)} /> {p.includeManual}</label>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {preview && (count === 0 ? <p className="text-sm text-gray-600">{p.nothing}</p> : (
            <div className="space-y-2">
              <p data-testid="prune-summary" className="text-sm font-medium">{fill(p.toDelete, { n: String(count), size: size(preview.reclaimedBytes) })} · {fill(p.kept, { n: String(preview.toKeep.length) })}</p>
              <ul className="max-h-40 overflow-y-auto text-xs text-gray-600">
                {preview.toDelete.map(r => (
                  <li key={r.id} data-testid="prune-row">{new Date(r.createdAt).toLocaleDateString(locale)} · {reasons[r.reason] ?? r.reason} · v{r.version} · {size(r.sizeBytes)}</li>
                ))}
              </ul>
              <label className="flex items-center gap-2 text-sm">{fill(p.confirm, { n: String(count) })}
                <input type="text" inputMode="numeric" className="input w-20" aria-label={fill(p.confirm, { n: String(count) })} value={typed} onChange={e => setTyped(e.target.value.trim())} />
              </label>
              <button type="button" className="btn-primary text-sm disabled:opacity-50" disabled={busy || typed !== String(count)} onClick={run}>{p.delete}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
