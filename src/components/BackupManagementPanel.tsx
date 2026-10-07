'use client'

// Planification et purge des sauvegardes, séparées de la carte de mise à jour.
import { useCallback, useEffect, useState } from 'react'
import BackupSchedulePanel from '@/components/BackupSchedulePanel'
import BackupPrunePanel from '@/components/BackupPrunePanel'
import { useTranslation } from '@/lib/i18n/context'
import { DEFAULT_BACKUP_POLICY, type BackupPolicy, type BackupStats } from '@/lib/backup-policy'

/** Commande à lancer sur le serveur, dans le dossier d'ACRA (l'application ne peut pas l'exécuter elle-même). */
const AGENT_INSTALL = 'scripts/update-agent.sh --install'

interface BackupInfo {
  agentAvailable: boolean
  offsite?: unknown
  backup?: { policy: BackupPolicy; stats: BackupStats | null } | null
}

export default function BackupManagementPanel() {
  const { t } = useTranslation()
  const [info, setInfo] = useState<BackupInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/version', { cache: 'no-store' })
      setInfo(response.ok ? await response.json() as BackupInfo : null)
    } catch {
      setInfo(null)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  if (loading) return <p className="text-sm text-gray-500 dark:text-gray-400">{t.loading}</p>
  if (!info) return <p role="alert" className="text-sm text-red-700 dark:text-red-400">{t.admin.storage.loadError}</p>
  // La section reste visible sans agent : la configuration est lue seule, et le message explique ce qui manque.
  const backup = info.backup ?? { policy: DEFAULT_BACKUP_POLICY, stats: null }

  async function copyCommand() {
    try { await navigator.clipboard.writeText(AGENT_INSTALL); setCopied(true) } catch { setCopied(false) }
  }

  async function backupNow() {
    setBusy(true); setMessage(null)
    try {
      const r = await fetch('/api/admin/backup/now', { method: 'POST' })
      const d = await r.json().catch(() => ({})) as { error?: string }
      if (r.ok) { setMessage(t.version.backup.nowDone); await load() }
      else setMessage((t.version.backup.nowErrors as Record<string, string>)[String(d.error)] ?? t.version.backup.nowErrors.generic)
    } catch { setMessage(t.version.backup.nowErrors.generic) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t.version.backup.sectionTitle}</h2>
        <button type="button" className="btn-primary text-sm disabled:opacity-50" disabled={busy || !info.agentAvailable} title={info.agentAvailable ? undefined : t.version.backup.agentRequired} onClick={() => void backupNow()}>{t.version.backup.now}</button>
        {message && <span className="text-sm text-ebios-700">{message}</span>}
      </div>
      {!info.agentAvailable && (
        <div className="space-y-2 rounded-md bg-gray-50 p-3 text-sm dark:bg-gray-800">
          <p className="font-medium">{t.version.backup.agentInstallTitle}</p>
          <p className="text-xs text-gray-600 dark:text-gray-300">{t.version.backup.agentWhy}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-sm bg-white px-2 py-1 font-mono text-xs dark:bg-gray-900">{AGENT_INSTALL}</code>
            <button type="button" className="btn-secondary text-xs" onClick={() => void copyCommand()}>{t.version.backup.copyCommand}</button>
            {copied && <span className="text-xs text-ebios-700">{t.version.backup.copied}</span>}
          </div>
          <p className="text-xs text-gray-500">{t.version.backup.agentAfter}</p>
        </div>
      )}
      <BackupSchedulePanel key={JSON.stringify(backup.policy)} policy={backup.policy} stats={backup.stats} agentAvailable={info.agentAvailable} offsiteConfigured={Boolean(info.offsite)} onChanged={load} />
      <BackupPrunePanel policy={backup.policy} agentAvailable={info.agentAvailable} onChanged={load} />
    </div>
  )
}
