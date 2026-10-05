'use client'

// Planification et purge des sauvegardes, séparées de la carte de mise à jour.
import { useCallback, useEffect, useState } from 'react'
import BackupSchedulePanel from '@/components/BackupSchedulePanel'
import BackupPrunePanel from '@/components/BackupPrunePanel'
import { useTranslation } from '@/lib/i18n/context'
import type { BackupPolicy, BackupStats } from '@/lib/backup-policy'

interface BackupInfo {
  agentAvailable: boolean
  offsite?: unknown
  backup?: { policy: BackupPolicy; stats: BackupStats | null } | null
}

export default function BackupManagementPanel() {
  const { t } = useTranslation()
  const [info, setInfo] = useState<BackupInfo | null>(null)
  const [loading, setLoading] = useState(true)

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
  if (!info.backup || (!info.agentAvailable && !info.backup.stats)) {
    return <p className="text-sm text-amber-800 dark:text-amber-300">{t.version.backup.agentRequired}</p>
  }

  return (
    <div className="space-y-4">
      <BackupSchedulePanel key={JSON.stringify(info.backup.policy)} policy={info.backup.policy} stats={info.backup.stats} agentAvailable={info.agentAvailable} offsiteConfigured={Boolean(info.offsite)} onChanged={load} />
      <BackupPrunePanel policy={info.backup.policy} agentAvailable={info.agentAvailable} onChanged={load} />
    </div>
  )
}
