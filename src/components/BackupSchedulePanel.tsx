'use client'

// Planification des sauvegardes (quotidienne / hebdomadaire / mensuelle, copies conservées), estimation de l'espace
// nécessaire et avertissements sur l'espace disque. L'application n'exécute rien : « Enregistrer » dépose une demande que
// l'agent hôte valide et applique ; les mesures d'espace viennent de l'agent (`backup-stats.json`).

import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { backupOverview, formatBytes, nextRuns, policyAdvice, validateBackupPolicy, type BackupPolicy, type BackupStats } from '@/lib/backup-policy'

interface Props { policy: BackupPolicy; stats: BackupStats | null; agentAvailable: boolean; offsiteConfigured: boolean; onChanged: () => void }
const fill = (s: string, vars: Record<string, string>) => Object.entries(vars).reduce((a, [k, v]) => a.replaceAll(`{${k}}`, v), s)
type Tier = 'daily' | 'weekly' | 'monthly'

export default function BackupSchedulePanel({ policy: initial, stats, agentAvailable, offsiteConfigured, onChanged }: Props) {
  const { t, locale } = useTranslation()
  const b = t.version.backup
  const [policy, setPolicy] = useState<BackupPolicy>(initial)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const valid = validateBackupPolicy(policy)
  const changed = useMemo(() => JSON.stringify(policy) !== JSON.stringify(initial), [policy, initial])
  const overview = useMemo(() => backupOverview(policy, stats), [policy, stats])
  const advice = useMemo(() => policyAdvice(policy), [policy])
  const runs = useMemo(() => nextRuns(policy, new Date()), [policy])
  const size = (n: number) => formatBytes(n, locale)
  const labels: Record<Tier, string> = { daily: b.daily, weekly: b.weekly, monthly: b.monthly }
  const adviceText = b as unknown as Record<string, string>

  const setTier = (tier: Tier, patch: Partial<{ enabled: boolean; keep: number; weekday: number; day: number }>) => setPolicy(p => ({ ...p, [tier]: { ...p[tier], ...patch } }) as BackupPolicy)
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Number.parseInt(v, 10) || min))

  async function save() {
    setBusy(true); setMessage(null)
    try {
      const r = await fetch('/api/admin/backup/policy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ policy }) })
      const data = await r.json().catch(() => ({}))
      if (r.ok) { setMessage(b.saved); onChanged() }
      else setMessage(data.error === 'request_pending' ? b.pending : fill(b.error, { error: String(data.error ?? r.status) }))
    } catch { setMessage(fill(b.error, { error: '—' })) } finally { setBusy(false) }
  }

  const verdict = overview.advice
  const verdictText = verdict.status === 'OK' ? b.ok
    : verdict.status === 'WARN' ? fill(b.warn, { extra: size(verdict.additionalBytes) })
    : verdict.status === 'CRITICAL' ? fill(b.critical, { missing: size(Math.max(verdict.missingBytes, 1)) })
    : b.unknown
  const verdictClass = verdict.status === 'OK' ? 'text-green-700' : verdict.status === 'UNKNOWN' ? 'text-gray-500' : 'text-red-700'
  const day = (d: Date | null) => (d ? d.toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')
  const lastOk = stats?.lastRunAt && stats.lastCode === 0
  const lastKo = stats?.lastRunAt && stats.lastCode !== null && stats.lastCode !== 0

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800"><CalendarClock size={15} aria-hidden="true" /> {b.title}</h3>
      <p className="text-xs text-gray-500">{b.intro}</p>

      <div className="space-y-2">
        {(['daily', 'weekly', 'monthly'] as Tier[]).map(tier => (
          <div key={tier} className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex w-36 items-center gap-2 font-medium">
              <input type="checkbox" aria-label={labels[tier]} checked={policy[tier].enabled} onChange={e => setTier(tier, { enabled: e.target.checked })} /> {labels[tier]}
            </label>
            <label className="flex items-center gap-1">
              <input type="number" min={1} max={60} aria-label={`${labels[tier]} — ${b.keep}`} className="input w-16" value={policy[tier].keep} disabled={!policy[tier].enabled} onChange={e => setTier(tier, { keep: num(e.target.value, 1, 60) })} /> {b.keep}
            </label>
            {tier === 'weekly' && (
              <label className="flex items-center gap-1">{b.weekday}
                <select className="input" value={policy.weekly.weekday} disabled={!policy.weekly.enabled} onChange={e => setTier('weekly', { weekday: Number(e.target.value) })}>
                  {b.weekdays.map((w, i) => <option key={i} value={i}>{w}</option>)}
                </select>
              </label>
            )}
            {tier === 'monthly' && (
              <label className="flex items-center gap-1">{b.day}
                <input type="number" min={1} max={28} className="input w-16" value={policy.monthly.day} disabled={!policy.monthly.enabled} onChange={e => setTier('monthly', { day: num(e.target.value, 1, 28) })} />
              </label>
            )}
          </div>
        ))}
        <label className="flex items-center gap-2 text-sm">{b.hour}
          <select className="input" value={policy.hour} onChange={e => setPolicy(p => ({ ...p, hour: Number(e.target.value) }))}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
          </select>
        </label>
      </div>

      {!valid.ok && valid.errors.includes('frequencies') && <p role="alert" className="text-sm text-red-700">{b.noFrequency}</p>}

      <div className="rounded-md bg-gray-50 px-3 py-2 text-sm space-y-1">
        <p data-testid="estimate">{fill(b.estimate, { total: size(overview.estimate.totalBytes), sched: size(overview.estimate.scheduledBytes), points: String(overview.estimate.scheduledPoints), pre: size(overview.estimate.preUpdateBytes) })}</p>
        {stats && <p data-testid="free-line" className="text-gray-600">{fill(b.freeLine, { free: stats.freeBytes === null ? '—' : size(stats.freeBytes), used: size(stats.backupsBytes) })}</p>}
        <p data-testid="verdict" role={verdict.status === 'WARN' || verdict.status === 'CRITICAL' ? 'alert' : 'status'} className={`flex items-start gap-1.5 ${verdictClass}`}>
          {verdict.status === 'OK' ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />}
          <span>{verdictText}</span>
        </p>
        {stats && stats.lastScheduledPointBytes === null && stats.lastPreUpdatePointBytes === null && <p className="text-xs text-gray-500">{b.noMeasure}</p>}
      </div>

      {advice.length > 0 && (
        <ul data-testid="advice" className="list-disc space-y-0.5 pl-5 text-sm text-amber-800">
          {advice.map(a => <li key={a}>{adviceText[a]}</li>)}
          <li className="list-none -ml-5 pl-5 text-xs text-gray-500">{b.recommended}</li>
        </ul>
      )}
      {!offsiteConfigured && <p className="text-sm text-amber-800">{b.offsiteHint}</p>}

      <p data-testid="last-run" className={`text-sm ${lastKo ? 'text-red-700' : 'text-gray-600'}`}>
        {lastOk ? fill(b.lastRun, { when: new Date(stats!.lastRunAt!).toLocaleString(locale), tiers: stats!.lastTiers.map(x => labels[x]).join(', ') })
          : lastKo ? fill(b.lastFail, { code: String(stats!.lastCode) }) : b.never}
      </p>
      <p data-testid="next-runs" className="text-xs text-gray-500">
        {b.next} : {(['daily', 'weekly', 'monthly'] as Tier[]).filter(k => policy[k].enabled).map(k => `${labels[k]} ${day(runs[k])}`).join(' · ')}
      </p>

      {!agentAvailable && <p className="text-sm text-amber-800">{b.agentRequired}</p>}
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary text-sm disabled:opacity-50" disabled={busy || !agentAvailable || !valid.ok || !changed} onClick={save}>{b.save}</button>
        {message && <span className="text-sm text-ebios-700">{message}</span>}
      </div>
    </div>
  )
}
