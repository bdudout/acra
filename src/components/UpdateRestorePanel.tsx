'use client'

// Avancement de la mise à jour, résultat (dont retour arrière automatique) et points de restauration —
// docs/specs/sauvegarde-rollback-spec.md, lot 4. Intégré à la carte « Version & mises à jour » (SUPER_ADMIN).
// L'application ne lance aucune commande : « Revenir à ce point » dépose une demande pour l'agent hôte.

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, History } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import type { UpdateStatus } from '@/lib/update-request'
import type { SnapshotEntry } from '@/lib/snapshot'
import type { RunSummary } from '@/lib/update-request.server'
import { offsiteHealth, type OffsiteState } from '@/lib/offsite-status'

interface Props {
  status: UpdateStatus | null
  run: Pick<RunSummary, 'steps' | 'state'> | null
  snapshots: SnapshotEntry[]
  impacts?: Record<string, { auditEntries: number; documents: number }>
  retentionDays?: number
  offsite?: OffsiteState | null
  offsiteMaxAgeHours?: number
  agentAvailable: boolean
  onChanged: () => void
}

const mb = (n: number) => `${Math.max(1, Math.round(n / 1048576))} Mo`
const fill = (s: string, vars: Record<string, string>) => Object.entries(vars).reduce((a, [k, v]) => a.replaceAll(`{${k}}`, v), s)

export default function UpdateRestorePanel({ status, run, snapshots, impacts, retentionDays = 14, offsite = null, offsiteMaxAgeHours = 48, agentAvailable, onChanged }: Props) {
  const { t, locale } = useTranslation()
  const v = t.version
  const steps = v.updateSteps as Record<string, string>
  const codes = v.updateCodes as Record<string, string>
  const [target, setTarget] = useState<SnapshotEntry | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const inProgress = status?.state === 'PENDING' || status?.state === 'RUNNING' || Boolean(run && !['ROLLED_BACK', 'ROLLBACK_FAILED', 'DONE'].includes(run.state))
  const done = status?.steps ?? run?.steps.map(s => ({ step: s.state, ok: s.ok, at: s.at })) ?? []
  const label = (s: string) => steps[s] ?? s
  const date = (iso: string) => new Date(iso).toLocaleString(locale)

  async function submit() {
    if (!target) return
    setBusy(true); setMessage(null)
    try {
      const r = await fetch('/api/admin/version/rollback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ snapshotId: target.id, confirmVersion: typed.trim() }) })
      const data = await r.json().catch(() => ({}))
      if (r.ok) { setMessage(v.restore.requested); setTarget(null); setTyped(''); onChanged() }
      else setMessage(fill(v.restore.error, { error: String(data.error ?? r.status) }))
    } catch { setMessage(fill(v.restore.error, { error: '—' })) } finally { setBusy(false) }
  }

  const failedHard = status?.state === 'FAILED' && status.code === 'rollback_failed'
  const rolledBack = status?.state === 'FAILED' && status.rolledBack === true && !failedHard
  const restoredManual = status?.state === 'SUCCESS' && status.rolledBack === true

  return (
    <div className="mt-4 space-y-3">
      {status?.precheck?.destructive?.length ? (
        <p role="note" className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {fill(v.restore.destructiveNote, { count: String(status.precheck.destructive.length) })}
        </p>
      ) : null}
      {inProgress && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{v.restore.progressTitle}</h3>
          <ol className="mt-1 space-y-0.5 text-sm">
            {done.map((s, i) => (
              <li key={`${s.step}-${i}`} className={s.ok ? 'text-green-700' : 'text-red-700'}>{label(s.step)}</li>
            ))}
            {status?.step && !done.some(s => s.step === status.step) && (
              <li aria-current="step" className="font-medium text-ebios-700">{label(status.step)}</li>
            )}
          </ol>
        </div>
      )}

      {failedHard && (
        <p role="alert" className="flex items-start gap-1.5 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{v.restore.rollbackFailed} <span className="font-mono text-xs">{v.restore.runbook}</span></span>
        </p>
      )}
      {rolledBack && status && (
        <p role="status" className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {fill(v.restore.rolledBack, { to: status.to ?? '—', from: status.from ?? '—', step: label(failedStep(status)) })}
            {status.code && <> ({codes[status.code] ?? status.code})</>}
          </span>
        </p>
      )}
      {restoredManual && status && (
        <p role="status" className="flex items-center gap-1.5 text-sm text-green-700"><CheckCircle2 size={15} aria-hidden="true" /> {fill(v.restore.restoredOk, { from: status.from ?? '—' })}</p>
      )}
      {status?.state === 'FAILED' && !status.rolledBack && !failedHard && status.code && (
        <p role="status" className="text-sm text-red-700">{fill(v.restore.failedNoChange, { code: codes[status.code] ?? status.code })}</p>
      )}

      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800"><History size={15} aria-hidden="true" /> {v.restore.title}</h3>
        {snapshots.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">{v.restore.none}</p>
        ) : (
          <div className="mt-1 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-gray-500">
                <tr><th className="py-1 pr-3 font-medium">{v.restore.colDate}</th><th className="pr-3 font-medium">{v.restore.colVersion}</th><th className="pr-3 font-medium">{v.restore.colVerified}</th><th className="pr-3 font-medium">{v.restore.colClone}</th><th className="pr-3 font-medium">{v.restore.colDocuments}</th><th className="pr-3 font-medium">{v.restore.colSize}</th><th /></tr>
              </thead>
              <tbody>
                {snapshots.map(s => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="py-1.5 pr-3">{date(s.createdAt)}</td>
                    <td className="pr-3 font-mono">{s.version}</td>
                    <td className="pr-3">{s.verified === 'full' ? v.restore.verifiedFull : v.restore.verifiedQuick}</td>
                    <td className="pr-3">{s.clone ? v.restore.yes : v.restore.no}</td>
                    <td className="pr-3">{s.documents ? v.restore.yes : v.restore.no}</td>
                    <td className="pr-3">{mb(s.sizeBytes)}</td>
                    <td className="text-right">
                      {agentAvailable && !inProgress && (
                        <button type="button" className="btn-secondary text-xs" onClick={() => { setTarget(s); setTyped(''); setMessage(null) }}>{v.restore.revert}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {message && <p className="text-sm text-ebios-700">{message}</p>}

      <OffsiteSection offsite={offsite} maxAgeHours={offsiteMaxAgeHours} />

      {target && (
        <div role="dialog" aria-modal="true" aria-labelledby="restore-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 id="restore-dialog-title" className="text-base font-semibold text-gray-900">{v.restore.dialogTitle}</h3>
            <p className="mt-2 text-sm text-gray-700">{fill(v.restore.dialogIntro, { version: target.version, date: date(target.createdAt) })}</p>
            <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="flex items-start gap-1.5"><AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> {v.restore.dialogWarning}</p>
              {impacts?.[target.id] && <p className="mt-1" data-testid="restore-impact">{fill(v.restore.dialogImpact, { audit: String(impacts[target.id].auditEntries), documents: String(impacts[target.id].documents) })}</p>}
              <p className="mt-1">{fill(v.restore.dialogKeep, { days: String(retentionDays) })}</p>
              <p className="mt-1">{v.restore.dialogSecrets}</p>
            </div>
            <label htmlFor="restore-confirm" className="mt-3 block text-sm font-medium text-gray-800">{fill(v.restore.confirmLabel, { version: target.version })}</label>
            <input id="restore-confirm" className="input mt-1 w-full font-mono" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={() => { setTarget(null); setTyped('') }}>{v.restore.cancel}</button>
              <button type="button" className="btn-primary text-sm disabled:opacity-50" disabled={busy || typed.trim() !== target.version} onClick={submit}>{v.restore.confirmButton}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Étape à laquelle l'échec a eu lieu : la dernière étape en échec du journal publié, sinon déduite du code. */
function failedStep(s: UpdateStatus): string {
  const ko = [...(s.steps ?? [])].reverse().find(x => !x.ok && x.step !== 'ROLLBACK_FAILED')
  if (ko) return ko.step
  const m: Record<string, string> = { migrate_failed: 'MIGRATE', start_failed: 'START', health_failed: 'HEALTH', smoke_failed: 'SMOKE', handoff_failed: 'HANDOFF', fetch_failed: 'FETCH' }
  return (s.code && m[s.code]) || 'MIGRATE'
}

function OffsiteSection({ offsite, maxAgeHours }: { offsite: OffsiteState | null; maxAgeHours: number }) {
  const { t } = useTranslation()
  const o = t.version.offsite
  const drivers = o.drivers as Record<string, string>
  const h = offsiteHealth(offsite, new Date(), maxAgeHours)
  const tone = h.status === 'OK' ? 'text-green-700' : h.status === 'NONE' ? 'text-gray-500' : 'text-red-700'
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-800">{o.title}</h3>
      {h.status === 'NONE' ? (
        <p className="mt-1 text-sm text-gray-500">{o.none}</p>
      ) : (
        <p role={h.status === 'OK' ? 'status' : 'alert'} className={`mt-1 text-sm ${tone}`} data-testid="offsite-status">
          {o.states[h.status as 'OK' | 'LATE' | 'FAILED']}
          {' — '}{drivers[offsite?.driver ?? 'none'] ?? offsite?.driver}
          {offsite?.lastSuccessAt ? ` — ${o.lastSend.replace('{hours}', String(h.ageHours ?? 0))}` : ` — ${o.never}`}
          {h.status === 'LATE' && ` (${o.threshold.replace('{hours}', String(maxAgeHours))})`}
        </p>
      )}
    </div>
  )
}
