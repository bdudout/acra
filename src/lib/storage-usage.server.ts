// ─── Supervision du stockage : mesures (lecture seule) — docs/specs/stockage-supervision-nettoyage.md, lot A ───
// Base : pg_database_size / pg_total_relation_size / pg_stat_user_tables. Documents : somme des tailles + statfs du volume local.
// Sauvegardes et hôte Docker : fichiers publiés par l'agent hôte (.acra-update). L'application n'exécute aucune commande.

import fs from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { backupOverview, type DiskStatus } from '@/lib/backup-policy'
import { classifyUsage, projectFullDate, topTables, parseHostStats, DEFAULT_THRESHOLDS, type HostStats, type Thresholds } from '@/lib/storage-usage'
import { readUpdateAgent, updateDir } from '@/lib/update-request.server'
import { defaultAutoCategories } from '@/lib/cache-cleanup'
import { previewInstanceCleanup, getCleanupSettings, type CleanupSettings } from '@/lib/cache-cleanup.instance.server'

export interface StorageReport {
  measuredAt: string
  thresholds: Thresholds
  db: { totalBytes: number; status: DiskStatus; tables: Array<{ name: string; totalBytes: number; live: number; dead: number; deadRatio: number; vacuum: boolean }> }
  documents: { count: number; totalBytes: number; backend: string; volume: { freeBytes: number; totalBytes: number; percent: number } | null; status: DiskStatus; byOrg: Array<{ organizationId: string; name: string; count: number; bytes: number }> }
  backups: { points: number; totalBytes: number; freeBytes: number | null; status: DiskStatus; oldestAt: string | null; newestAt: string | null; byReason: Record<string, number> } | null
  host: (HostStats & { status: DiskStatus }) | null
  cleanable: { count: number; bytes: number; rows: Array<{ id: string; count: number; bytes: number }> }
  cleanup: CleanupSettings
  trend: { series: Array<{ at: string; freeBytes: number }>; fullDate: string | null }
}

const CACHE_MS = 5 * 60_000
let cache: { at: number; report: StorageReport } | null = null
export function resetStorageCache() { cache = null }

async function readJson(file: string): Promise<unknown> {
  try { const st = await fs.stat(file); if (!st.isFile() || st.size > 64 * 1024) return null; return JSON.parse(await fs.readFile(file, 'utf8')) } catch { return null }
}

export async function getThresholds(): Promise<Thresholds> {
  const c = await prisma.configuration.findUnique({ where: { id: 'global' }, select: { storageWarnPercent: true, storageCriticalPercent: true } })
  return c ? { warnPercent: c.storageWarnPercent, criticalPercent: c.storageCriticalPercent } : DEFAULT_THRESHOLDS
}

export async function saveThresholds(t: Thresholds): Promise<void> {
  const { resolveScaleConfig } = await import('@/lib/risk-scale')
  const sc = resolveScaleConfig(null)
  await prisma.configuration.upsert({
    where: { id: 'global' }, update: { storageWarnPercent: t.warnPercent, storageCriticalPercent: t.criticalPercent },
    create: { id: 'global', nbNiveaux: sc.nbNiveaux, echelleGravite: sc.echelleGravite as unknown as object, echelleVraisemblance: sc.echelleVraisemblance as unknown as object, seuilsMatrice: sc.seuilsMatrice as unknown as object, matriceMode: sc.matriceMode, storageWarnPercent: t.warnPercent, storageCriticalPercent: t.criticalPercent },
  })
}

async function dbBlock(): Promise<StorageReport['db']> {
  const [size] = await prisma.$queryRaw<Array<{ size: number }>>`SELECT pg_database_size(current_database())::float8 AS size`
  const rows = await prisma.$queryRaw<Array<{ name: string; total: number; live: number; dead: number }>>`
    SELECT relname AS name, pg_total_relation_size(relid)::float8 AS total, n_live_tup::float8 AS live, n_dead_tup::float8 AS dead
    FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 10`
  const tables = topTables(rows.map(r => ({ name: r.name, totalBytes: r.total, live: r.live, dead: r.dead })), 10)
  return { totalBytes: size?.size ?? 0, tables, status: tables.some(t => t.vacuum) ? 'WARN' : 'OK' }
}

async function docsBlock(th: Thresholds): Promise<StorageReport['documents']> {
  const [agg, groups] = await Promise.all([
    prisma.document.aggregate({ _count: { _all: true }, _sum: { taille: true } }),
    prisma.document.groupBy({ by: ['organizationId'], _count: { _all: true }, _sum: { taille: true }, orderBy: { _sum: { taille: 'desc' } }, take: 10 }),
  ])
  const orgs = await prisma.organization.findMany({ where: { id: { in: groups.map(g => g.organizationId) } }, select: { id: true, nom: true } })
  const name = new Map(orgs.map(o => [o.id, o.nom]))
  const backend = (process.env.DOCUMENT_STORAGE ?? 'local').toLowerCase()
  let volume: StorageReport['documents']['volume'] = null
  if (backend !== 's3') {
    try {
      const dir = process.env.DOCUMENT_STORAGE_DIR || path.join(process.cwd(), '.data', 'documents')
      const s = await fs.statfs(dir)
      const total = s.blocks * s.bsize, free = s.bavail * s.bsize
      volume = { freeBytes: free, totalBytes: total, percent: classifyUsage(total - free, total, th).percent }
    } catch { volume = null }
  }
  const status = volume ? classifyUsage(volume.totalBytes - volume.freeBytes, volume.totalBytes, th).status : 'UNKNOWN'
  return {
    count: agg._count._all, totalBytes: agg._sum.taille ?? 0, backend, volume, status,
    byOrg: groups.map(g => ({ organizationId: g.organizationId, name: name.get(g.organizationId) ?? '—', count: g._count._all, bytes: g._sum.taille ?? 0 })),
  }
}

/** Mesure complète (cache serveur de 5 minutes : les requêtes de taille sont coûteuses sur une grosse base). */
export async function getStorageReport(opts: { fresh?: boolean } = {}): Promise<StorageReport> {
  if (!opts.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.report
  const th = await getThresholds()
  const [db, documents, agent, hostRaw, cleanup, snaps] = await Promise.all([
    dbBlock(), docsBlock(th), readUpdateAgent(), readJson(path.join(updateDir(), 'host-stats.json')),
    getCleanupSettings(),
    prisma.storageSnapshot.findMany({ where: { mesureLe: { gte: new Date(Date.now() - 90 * 86400_000) }, freeBytes: { not: null } }, orderBy: { mesureLe: 'asc' }, select: { mesureLe: true, freeBytes: true } }),
  ])
  const preview = await previewInstanceCleanup(defaultAutoCategories())
  const stats = agent.backup.stats
  const sn = agent.snapshots
  const byReason: Record<string, number> = {}
  for (const s of sn) byReason[s.reason] = (byReason[s.reason] ?? 0) + 1
  const dates = sn.map(s => s.createdAt).sort()
  const backups: StorageReport['backups'] = stats || sn.length ? {
    points: sn.length, totalBytes: stats?.backupsBytes ?? sn.reduce((n, s) => n + s.sizeBytes, 0), freeBytes: stats?.freeBytes ?? null,
    status: backupOverview(agent.backup.policy, stats).advice.status, oldestAt: dates[0] ?? null, newestAt: dates[dates.length - 1] ?? null, byReason,
  } : null
  const host = parseHostStats(hostRaw)
  const series = snaps.map(s => ({ at: s.mesureLe.toISOString(), freeBytes: s.freeBytes as number }))
  const report: StorageReport = {
    measuredAt: new Date().toISOString(), thresholds: th, db, documents, backups,
    host: host ? { ...host, status: host.reclaimableBytes >= 5e9 ? 'WARN' : 'OK' } : null,
    cleanable: { count: preview.reduce((n, r) => n + r.count, 0), bytes: preview.reduce((n, r) => n + r.bytes, 0), rows: preview },
    cleanup, trend: { series, fullDate: projectFullDate(series, new Date())?.toISOString() ?? null },
  }
  cache = { at: Date.now(), report }
  return report
}

/** Une ligne par jour (appelée par le cron de nettoyage) ; purge au-delà de 400 jours (B10). Rend le nombre de lignes purgées. */
export async function recordDailyStorageSnapshot(): Promise<{ recorded: boolean; purged: number }> {
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0)
  const purged = (await prisma.storageSnapshot.deleteMany({ where: { mesureLe: { lt: new Date(Date.now() - 400 * 86400_000) } } })).count
  if (await prisma.storageSnapshot.findFirst({ where: { mesureLe: { gte: startOfDay } }, select: { id: true } })) return { recorded: false, purged }
  const r = await getStorageReport({ fresh: true })
  await prisma.storageSnapshot.create({
    data: {
      dbBytes: r.db.totalBytes, documentsBytes: r.documents.totalBytes, backupsBytes: r.backups?.totalBytes ?? 0,
      freeBytes: r.backups?.freeBytes ?? r.documents.volume?.freeBytes ?? null, hostReclaimableBytes: r.host?.reclaimableBytes ?? null,
    },
  })
  return { recorded: true, purged }
}

/** Part « documents » d'un périmètre d'organisations (ADMIN d'organisation : lecture seule, jamais les autres blocs). */
export async function orgDocumentsUsage(scope: { all: boolean; ids: string[] }): Promise<{ count: number; totalBytes: number }> {
  const agg = await prisma.document.aggregate({ where: scope.all ? {} : { organizationId: { in: scope.ids } }, _count: { _all: true }, _sum: { taille: true } })
  return { count: agg._count._all, totalBytes: agg._sum.taille ?? 0 }
}
