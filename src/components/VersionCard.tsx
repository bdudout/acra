'use client'

// Carte « Version & mises à jour » (SUPER_ADMIN, tableau de bord admin) — #185.
// Version installée + canal (stable / bêta basée sur la dernière version validée),
// comparaison à la dernière release stable GitHub, et mise à jour :
//  - instance de démonstration gérée : déclenchement du workflow GitHub (deploy) ;
//  - instance auto-hébergée avec agent hôte : demande déposée pour l'agent, qui
//    sauvegarde, met à jour (git), reconstruit et vérifie la santé ;
//  - sinon : commandes exactes à lancer sur le serveur.

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, CheckCircle2, ArrowUpCircle, AlertTriangle, Rocket, Download } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import UpdateRestorePanel from '@/components/UpdateRestorePanel'
import type { UpdateStatus as FullUpdateStatus } from '@/lib/update-request'
import type { SnapshotEntry } from '@/lib/snapshot'
import type { OffsiteState } from '@/lib/offsite-status'
import type { RunSummary } from '@/lib/update-request.server'

type Channel = 'stable' | 'beta'
interface UpdateStatus { state: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'; channel?: Channel; version?: string; message?: string; at?: string }
interface VersionInfo {
  current: string
  channel: Channel
  base: string | null
  agentAvailable: boolean
  updateStatus: (UpdateStatus & Partial<FullUpdateStatus>) | null
  snapshots?: SnapshotEntry[]
  impacts?: Record<string, { auditEntries: number; documents: number }>
  failedDbRetentionDays?: number
  offsite?: OffsiteState | null
  offsiteMaxAgeHours?: number
  run?: RunSummary | null
  latest: string | null
  latestName: string | null
  releaseUrl: string | null
  publishedAt: string | null
  updateAvailable: boolean
  reachable: boolean
  repo: string
  deployConfigured: boolean
}

export default function VersionCard() {
  const { t } = useTranslation()
  const v = t.version
  const [info, setInfo] = useState<VersionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/version', { cache: 'no-store' })
      setInfo(r.ok ? await r.json() : null)
    } catch { setInfo(null) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  // Suivi : tant qu'une mise à jour est en attente ou en cours, on rafraîchit.
  const inProgress = info?.updateStatus?.state === 'PENDING' || info?.updateStatus?.state === 'RUNNING'
  useEffect(() => {
    if (!inProgress) return
    const id = window.setInterval(load, 10_000)
    return () => window.clearInterval(id)
  }, [inProgress, load])

  async function deploy() {
    if (!info?.latest || !window.confirm(v.deployConfirm.replace('{version}', info.latest))) return
    setBusy(true); setMessage(null)
    try {
      const r = await fetch('/api/admin/version/deploy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: info.latest }) })
      const data = await r.json().catch(() => ({}))
      setMessage(r.ok ? v.deployStarted : (data.error ?? v.deployError))
      if (r.ok && data.workflowUrl) window.open(data.workflowUrl, '_blank', 'noopener,noreferrer')
    } catch { setMessage(v.deployError) } finally { setBusy(false) }
  }

  async function requestUpdate(channel: Channel) {
    const label = channel === 'stable' ? v.channelStable : v.channelBetaShort
    if (!window.confirm(v.updateConfirm.replace('{channel}', label))) return
    setBusy(true); setMessage(null)
    try {
      const r = await fetch('/api/admin/version/update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel }) })
      const data = await r.json().catch(() => ({}))
      setMessage(r.ok ? v.updateRequested : v.updateError.replace('{error}', String(data.error ?? r.status)))
      if (r.ok) load()
    } catch { setMessage(v.updateError.replace('{error}', '—')) } finally { setBusy(false) }
  }

  const other: Channel = info?.channel === 'beta' ? 'stable' : 'beta'
  const st = info?.updateStatus
  const states = v.states as Record<string, string>

  return (
    <div className="card p-5 mb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-0.5">{v.title}</h2>
          <p className="text-sm text-gray-500">
            {v.installed} <span className="font-mono font-medium text-gray-800">{info?.current ?? '—'}</span>
            {info && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${info.channel === 'beta' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                {info.channel === 'beta' ? (info.base ? v.channelBeta.replace('{base}', info.base) : v.channelBetaShort) : v.channelStable}
              </span>
            )}
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> {v.check}
        </button>
      </div>

      <div className="mt-3 text-sm">
        {loading && !info ? (
          <span className="text-gray-400">{v.checking}</span>
        ) : !info || !info.reachable ? (
          <span className="inline-flex items-center gap-1.5 text-amber-700">
            <AlertTriangle size={15} aria-hidden="true" /> {v.unreachable}
          </span>
        ) : info.updateAvailable ? (
          <div className="rounded-lg border border-ebios-200 bg-ebios-50 px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-ebios-800 font-medium">
              <ArrowUpCircle size={16} aria-hidden="true" /> {v.updateAvailable} {info.latest}
            </span>
            {info.releaseUrl && (
              <a href={info.releaseUrl} target="_blank" rel="noopener noreferrer" className="text-ebios-700 hover:underline text-sm font-medium">
                {v.seeNotes} →
              </a>
            )}
            {info.deployConfigured && <button onClick={deploy} disabled={busy} className="btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-50"><Rocket size={14} aria-hidden="true" /> {busy ? v.deploying : v.deploy}</button>}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-green-700">
            <CheckCircle2 size={15} aria-hidden="true" /> {info.latest ? v.upToDateWithLatest.replace('{v}', info.latest) : v.upToDate}
          </span>
        )}
      </div>

      {/* Instance auto-hébergée avec agent : mise à jour depuis l'interface. */}
      {info && !info.deployConfigured && info.agentAvailable && (
        <p className="mt-3 text-xs text-gray-500">{v.restore.preUpdateNote}</p>
      )}
      {info && !info.deployConfigured && info.agentAvailable && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button onClick={() => requestUpdate(info.channel)} disabled={busy || inProgress} className="btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-50">
            <Download size={14} aria-hidden="true" /> {v.updateNow}
          </button>
          <button onClick={() => requestUpdate(other)} disabled={busy || inProgress} className="btn-secondary text-sm disabled:opacity-50">
            {other === 'stable' ? v.switchToStable : v.switchToBeta}
          </button>
        </div>
      )}
      {st && (
        <p role="status" className={`mt-2 text-sm ${st.state === 'FAILED' ? 'text-red-700' : st.state === 'SUCCESS' ? 'text-green-700' : 'text-ebios-700'}`}>
          {v.lastUpdate.replace('{state}', states[st.state] ?? st.state).replace('{message}', [st.version, st.message].filter(Boolean).join(' — '))}
        </p>
      )}
      {message && <p className="mt-2 text-sm text-ebios-700">{message}</p>}
      {info && !info.deployConfigured && (info.agentAvailable || (info.snapshots?.length ?? 0) > 0 || info.updateStatus) && (
        <UpdateRestorePanel status={(info.updateStatus as FullUpdateStatus | null) ?? null} run={info.run ?? null} snapshots={info.snapshots ?? []} impacts={info.impacts} retentionDays={info.failedDbRetentionDays} offsite={info.offsite ?? null} offsiteMaxAgeHours={info.offsiteMaxAgeHours} agentAvailable={info.agentAvailable} onChanged={load} />
      )}

      <details className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <summary className="cursor-pointer font-medium text-gray-700">{v.helpTitle}</summary>
        {info?.deployConfigured ? <p className="mt-2">{v.helpOneClick}</p> : (
          <div className="mt-2 space-y-2">
            <p>{v.commandsIntro}</p>
            <p className="font-medium">{v.commandStable}</p>
            <pre className="overflow-x-auto rounded-sm bg-white p-2 font-mono text-[11px]">scripts/update.sh stable</pre>
            <p className="font-medium">{v.commandBeta}</p>
            <pre className="overflow-x-auto rounded-sm bg-white p-2 font-mono text-[11px]">scripts/update.sh beta</pre>
            <p>{v.commandsGit}</p>
            <pre className="overflow-x-auto rounded-sm bg-white p-2 font-mono text-[11px]">{'git checkout stable && git pull && docker compose up -d --build'}</pre>
            {info && !info.agentAvailable && (
              <div>
                <p className="font-medium">{v.agentTitle}</p>
                <p>{v.agentIntro}</p>
                <pre className="overflow-x-auto rounded-sm bg-white p-2 font-mono text-[11px]">scripts/update-agent.sh --install</pre>
              </div>
            )}
          </div>
        )}
      </details>
    </div>
  )
}
