'use client'

// Supervision du stockage (SUPER_ADMIN : base, documents, sauvegardes, hôte Docker, nettoyable ; ADMIN : documents de son
// périmètre) + nettoyage du cache sans impact. L'application ne touche jamais l'hôte : elle affiche ce que mesure l'agent.

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, HardDrive, RefreshCw } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { formatBytes, validateThresholds, storageAlertCauses, type Thresholds } from '@/lib/storage-usage'
import { defaultAutoCategories, CLEANUP_CATEGORIES, type CleanupId } from '@/lib/cache-cleanup'
import type { StorageReport } from '@/lib/storage-usage.server'

type Status = 'OK' | 'WARN' | 'CRITICAL' | 'UNKNOWN'
type Payload = { scope: 'instance'; report: StorageReport } | { scope: 'organization'; documents: { count: number; totalBytes: number } }
const fill = (s: string, vars: Record<string, string>) => Object.entries(vars).reduce((a, [k, v]) => a.replaceAll(`{${k}}`, v), s)
const COLOR: Record<Status, string> = { OK: 'bg-green-100 text-green-800', WARN: 'bg-amber-100 text-amber-800', CRITICAL: 'bg-red-100 text-red-800', UNKNOWN: 'bg-gray-100 text-gray-600' }

export default function StorageUsagePanel() {
  const { t, locale } = useTranslation()
  const s = t.admin.storage
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [warn, setWarn] = useState('80')
  const [crit, setCrit] = useState('90')
  const [thMessage, setThMessage] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<CleanupId[]>(defaultAutoCategories())
  const [preview, setPreview] = useState<Array<{ id: string; count: number; bytes: number }>>([])
  const [clMessage, setClMessage] = useState<string | null>(null)
  const [vacMessage, setVacMessage] = useState<string | null>(null)

  const size = (n: number) => formatBytes(n, locale)
  const load = useCallback(async (fresh = false) => {
    setBusy(true); setError(false)
    try {
      const r = await fetch(`/api/admin/storage${fresh ? '?fresh=1' : ''}`)
      if (!r.ok) throw new Error(String(r.status))
      const d = await r.json() as Payload
      setData(d)
      if (d.scope === 'instance') { setWarn(String(d.report.thresholds.warnPercent)); setCrit(String(d.report.thresholds.criticalPercent)) }
    } catch { setError(true) } finally { setBusy(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const loadPreview = useCallback(async (cats: CleanupId[]) => {
    try {
      const r = await fetch(`/api/admin/storage/cleanup?categories=${cats.join(',')}`)
      const d = await r.json().catch(() => ({}))
      setPreview(r.ok ? (d.preview ?? []) : [])
    } catch { setPreview([]) }
  }, [])
  useEffect(() => { if (open) void loadPreview(selected) }, [open, selected, loadPreview])

  async function runCleanup() {
    setBusy(true); setClMessage(null)
    try {
      const r = await fetch('/api/admin/storage/cleanup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ categories: selected }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        const total = Object.values(d.counts as Record<string, number>).reduce((n, v) => n + v, 0)
        setClMessage(total === 0 ? s.clNothing : fill(s.clDone, { count: String(total) })); await load(true)
      } else setClMessage(d.error === 'already_running' ? s.clRunning : fill(s.clError, { error: String(d.error ?? r.status) }))
    } catch { setClMessage(fill(s.clError, { error: '—' })) } finally { setBusy(false) }
  }

  async function runVacuum(tables: string[]) {
    setBusy(true); setVacMessage(null)
    try {
      const r = await fetch('/api/admin/storage/vacuum', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tables }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok) { setVacMessage(fill(s.vacuumDone, { tables: (d.vacuumed as string[]).join(', ') })); await load(true) }
      else setVacMessage(fill(s.vacuumError, { error: String(d.error ?? r.status) }))
    } catch { setVacMessage(fill(s.vacuumError, { error: '—' })) } finally { setBusy(false) }
  }

  async function saveThresholds() {
    const v: { ok: boolean; value?: Thresholds } = validateThresholds({ warnPercent: warn, criticalPercent: crit })
    if (!v.ok) { setThMessage(s.thInvalid); return }
    setBusy(true)
    try {
      const r = await fetch('/api/admin/storage', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v.value) })
      if (r.ok) { setThMessage(s.thSaved); await load(true) } else setThMessage(s.thInvalid)
    } catch { setThMessage(s.thInvalid) } finally { setBusy(false) }
  }

  const badge = (st: Status) => <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${COLOR[st]}`}>{s.st[st]}</span>

  if (error && !data) return <p className="text-sm text-red-700">{s.loadError}</p>
  if (!data) return null
  if (data.scope === 'organization') {
    return (
      <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800"><HardDrive size={15} aria-hidden="true" /> {s.title}</h3>
        <p className="text-sm">{fill(s.docCount, { n: String(data.documents.count) })}</p>
        <p className="text-sm text-gray-600">{fill(s.docTotal, { size: size(data.documents.totalBytes) })}</p>
      </section>
    )
  }

  const r = data.report
  const alerts = storageAlertCauses(r)
  const alertText = (a: ReturnType<typeof storageAlertCauses>[number]) =>
    a.kind === 'documents' ? fill(s.alertDocs, { percent: String(a.percent), threshold: String(a.threshold), free: size(a.freeBytes), total: size(a.totalBytes), acra: size(a.acraBytes) })
    : a.kind === 'backups' ? fill(s.alertBackups, { free: a.freeBytes === null ? '—' : size(a.freeBytes) })
    : a.kind === 'db' ? fill(s.alertDb, { n: String(a.vacuumTables) })
    : fill(s.alertHost, { size: size(a.reclaimableBytes) })
  const days = r.trend.fullDate ? Math.max(0, Math.ceil((Date.parse(r.trend.fullDate) - Date.now()) / 86400_000)) : null
  const when = (iso: string) => new Date(iso).toLocaleString(locale)
  const cats = s.cats as Record<string, string>
  const countOf = (id: string) => preview.find(p => p.id === id)?.count ?? 0
  const toggle = (id: CleanupId) => setSelected(cur => (cur.includes(id) ? cur.filter(x => x !== id) : CLEANUP_CATEGORIES.map(c => c.id).filter(x => cur.includes(x) || x === id)))
  const blockCls = 'rounded-md border border-gray-200 p-3 space-y-1 text-sm'

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800"><HardDrive size={15} aria-hidden="true" /> {s.title}</h3>
        <button type="button" className="btn-secondary flex items-center gap-1 text-xs disabled:opacity-50" disabled={busy} onClick={() => void load(true)}><RefreshCw size={12} aria-hidden="true" /> {s.refresh}</button>
      </div>
      <p className="text-xs text-gray-500">{s.intro} {fill(s.measured, { when: when(r.measuredAt) })}</p>
      {alerts.map(a => (
        <p key={a.kind} role="alert" className={`flex items-center gap-1.5 rounded px-3 py-2 text-sm ${COLOR[a.status]}`}><AlertTriangle size={15} aria-hidden="true" /> {alertText(a)}</p>
      ))}

      <div className="grid gap-3 md:grid-cols-2">
        <div data-testid="block-db" className={blockCls}>
          <p className="flex items-center justify-between font-medium">{s.db} {badge(r.db.status)}</p>
          <p>{s.dbTotal} : {size(r.db.totalBytes)}</p>
          <p className="text-xs text-gray-500">{s.dbTables}</p>
          <ul className="text-xs text-gray-700">
            {r.db.tables.map(tb => (
              <li key={tb.name}>{tb.name} · {size(tb.totalBytes)} · {tb.live} {s.live} · {tb.dead} {s.dead} {tb.vacuum && <strong className="text-amber-700">{s.vacuum}</strong>}</li>
            ))}
          </ul>
          {r.db.tables.some(tb => tb.vacuum) && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500">{s.vacuumNote}</p>
              <button type="button" className="btn-secondary text-sm disabled:opacity-50" disabled={busy} onClick={() => void runVacuum(r.db.tables.filter(tb => tb.vacuum).map(tb => tb.name))}>{s.vacuumButton}</button>
              {vacMessage && <p className="text-xs text-ebios-700">{vacMessage}</p>}
            </div>
          )}
        </div>

        <div data-testid="block-documents" className={blockCls}>
          <p className="flex items-center justify-between font-medium">{s.docs} {badge(r.documents.status)}</p>
          <p>{fill(s.docCount, { n: String(r.documents.count) })} · {fill(s.docTotal, { size: size(r.documents.totalBytes) })}</p>
          <p className="text-xs text-gray-600">{r.documents.volume ? fill(s.docFree, { free: size(r.documents.volume.freeBytes), total: size(r.documents.volume.totalBytes), percent: String(r.documents.volume.percent) }) : s.docS3}</p>
          {r.documents.byOrg.length > 0 && (<><p className="text-xs text-gray-500">{s.docOrg}</p>
            <ul className="text-xs text-gray-700">{r.documents.byOrg.map(o => <li key={o.organizationId}><span>{o.name}</span> · {o.count} · {size(o.bytes)}</li>)}</ul></>)}
        </div>

        <div data-testid="block-backups" className={blockCls}>
          <p className="flex items-center justify-between font-medium">{s.bk} {badge(r.backups?.status ?? 'UNKNOWN')}</p>
          {r.backups ? (<>
            <p>{fill(s.bkPoints, { n: String(r.backups.points), size: size(r.backups.totalBytes) })}</p>
            {r.backups.freeBytes !== null && <p className="text-xs text-gray-600">{fill(s.bkFree, { free: size(r.backups.freeBytes) })}</p>}
            {r.backups.oldestAt && r.backups.newestAt && <p className="text-xs text-gray-600">{fill(s.bkRange, { oldest: new Date(r.backups.oldestAt).toLocaleDateString(locale), newest: new Date(r.backups.newestAt).toLocaleDateString(locale) })}</p>}
          </>) : <p className="text-xs text-gray-600">{s.bkNone}</p>}
        </div>

        <div data-testid="block-host" className={blockCls}>
          <p className="flex items-center justify-between font-medium">{s.host} {badge(r.host?.status ?? 'UNKNOWN')}</p>
          {r.host ? (<>
            <p className="text-xs text-gray-700">{s.hostImages} {size(r.host.images.sizeBytes)} · {s.hostCache} {size(r.host.buildCache.sizeBytes)} · {s.hostVolumes} {size(r.host.volumes.sizeBytes)} · {s.hostContainers} {size(r.host.containers.sizeBytes)}</p>
            <p>{fill(s.hostReclaim, { size: size(r.host.reclaimableBytes) })}</p>
            <p className="text-xs text-gray-500">{s.hostHint}</p>
          </>) : <p className="text-xs text-gray-600">{s.hostNone}</p>}
        </div>
      </div>

      <p data-testid="trend" className="text-xs text-gray-600"><strong>{s.trend}</strong> : {days === null ? s.trendNone : fill(s.trendFull, { days: String(days) })}</p>

      <div data-testid="block-cleanable" className={blockCls}>
        <p className="font-medium">{s.clTitle}</p>
        <p>{fill(s.clLine, { count: String(r.cleanable.count), size: size(r.cleanable.bytes) })}</p>
        <p className="text-xs text-gray-600">{r.cleanup.autoCleanup ? s.clAuto : '—'} · {r.cleanup.lastCleanupAt ? fill(s.clLast, { when: when(r.cleanup.lastCleanupAt) }) : s.clNever}</p>
        <button type="button" className="btn-secondary text-sm disabled:opacity-50" disabled={r.cleanable.count === 0} onClick={() => { setClMessage(null); setOpen(o => !o) }}>{s.clButton}</button>
        <button type="button" className="btn-secondary ml-2 text-sm disabled:opacity-50" disabled>{s.reportsButton}</button>
        <p className="text-xs text-gray-500">{s.reportsNone}</p>
        {open && (
          <div role="dialog" aria-label={s.clModal} className="mt-2 space-y-2 rounded-md border border-gray-200 p-3">
            <p className="text-xs text-gray-500">{s.clIntro}</p>
            <ul className="space-y-1">
              {CLEANUP_CATEGORIES.map(c => (
                <li key={c.id}><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} /> {cats[c.id]} <span className="text-xs text-gray-500">({countOf(c.id)})</span></label></li>
              ))}
            </ul>
            <div className="flex items-center gap-3">
              <button type="button" className="btn-primary text-sm disabled:opacity-50" disabled={busy || selected.length === 0} onClick={() => void runCleanup()}>{s.clRun}</button>
              {clMessage && <span className="text-sm text-ebios-700">{clMessage}</span>}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 text-sm">
        <span className="font-medium">{s.thTitle}</span>
        <label className="flex items-center gap-1">{s.thWarn}<input type="number" className="input w-16" value={warn} onChange={e => setWarn(e.target.value)} /></label>
        <label className="flex items-center gap-1">{s.thCrit}<input type="number" className="input w-16" value={crit} onChange={e => setCrit(e.target.value)} /></label>
        <button type="button" className="btn-secondary text-sm disabled:opacity-50" disabled={busy} onClick={() => void saveThresholds()}>{s.thSave}</button>
        {thMessage && <span className="text-xs text-ebios-700">{thMessage}</span>}
      </div>
    </section>
  )
}
