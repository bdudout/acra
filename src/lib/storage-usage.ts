// ─── Supervision du stockage (PUR) — docs/specs/stockage-supervision-nettoyage.md, lot A ───
import type { DiskStatus } from '@/lib/backup-policy'
export { formatBytes } from '@/lib/backup-policy'

export interface Thresholds { warnPercent: number; criticalPercent: number }
export const DEFAULT_THRESHOLDS: Thresholds = { warnPercent: 80, criticalPercent: 90 }

/** Statut d'occupation : ≥ critique → CRITICAL, ≥ attention → WARN. Seuils incohérents → défauts. Total inconnu → UNKNOWN. */
export function classifyUsage(used: number, total: number | null, thresholds: Thresholds = DEFAULT_THRESHOLDS): { percent: number; status: DiskStatus } {
  if (total === null || !Number.isFinite(total) || total <= 0 || !Number.isFinite(used)) return { percent: 0, status: 'UNKNOWN' }
  const th = thresholds.warnPercent < thresholds.criticalPercent && thresholds.warnPercent > 0 ? thresholds : DEFAULT_THRESHOLDS
  const percent = Math.round((used / total) * 100)
  const raw = (used / total) * 100
  return { percent, status: raw >= th.criticalPercent ? 'CRITICAL' : raw >= th.warnPercent ? 'WARN' : 'OK' }
}

/** Seuils réglables : entiers, 50 ≤ attention < critique ≤ 99. */
export function validateThresholds(v: unknown): { ok: true; value: Thresholds } | { ok: false } {
  if (!v || typeof v !== 'object') return { ok: false }
  const o = v as { warnPercent?: unknown; criticalPercent?: unknown }
  const w = Number(o.warnPercent), c = Number(o.criticalPercent)
  if (!Number.isInteger(w) || !Number.isInteger(c) || w < 50 || c > 99 || w >= c) return { ok: false }
  return { ok: true, value: { warnPercent: w, criticalPercent: c } }
}

export const deadTupleRatio = (live: number, dead: number): number => (live + dead > 0 ? dead / (live + dead) : 0)
/** « VACUUM utile » : plus de 20 % de lignes mortes. */
export const needsVacuum = (live: number, dead: number): boolean => deadTupleRatio(live, dead) > 0.2

export interface FreeSample { at: string; freeBytes: number }
export const MIN_SAMPLES_FOR_PROJECTION = 7

/** Date de saturation par régression linéaire de l'espace libre (≥ 7 mesures valides, pente décroissante), sinon null. */
export function projectFullDate(series: FreeSample[], now: Date): Date | null {
  const pts = series.map(s => ({ t: Date.parse(s.at) / 86400_000, y: s.freeBytes })).filter(p => Number.isFinite(p.t) && Number.isFinite(p.y))
  if (pts.length < MIN_SAMPLES_FOR_PROJECTION) return null
  const n = pts.length
  const mt = pts.reduce((a, p) => a + p.t, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n
  const sxx = pts.reduce((a, p) => a + (p.t - mt) ** 2, 0)
  if (sxx === 0) return null
  const slope = pts.reduce((a, p) => a + (p.t - mt) * (p.y - my), 0) / sxx
  if (slope >= 0) return null
  const nowD = now.getTime() / 86400_000
  const freeNow = Math.max(0, my + slope * (nowD - mt))
  return new Date(now.getTime() + (freeNow / -slope) * 86400_000)
}

export interface TableRow { name: string; totalBytes: number; live: number; dead: number }
export function topTables(rows: TableRow[], n: number): Array<TableRow & { deadRatio: number; vacuum: boolean }> {
  return [...rows].sort((a, b) => b.totalBytes - a.totalBytes).slice(0, Math.max(0, n)).map(r => ({ ...r, deadRatio: deadTupleRatio(r.live, r.dead), vacuum: needsVacuum(r.live, r.dead) }))
}

// ── Hôte Docker : `docker system df` publié par l'agent ─────────────────────────────────────────

const UNITS: Record<string, number> = { B: 1, kB: 1e3, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12 }
/** « 1.5GB », « 500MB (45%) » → octets (unités décimales de Docker). Invalide ou négatif → null. */
export function parseDockerSize(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const m = v.trim().match(/^(\d+(?:\.\d+)?)\s*([kKMGT]?B)\b/)
  if (!m) return null
  const u = UNITS[m[2]]
  return u === undefined ? null : Math.round(Number(m[1]) * u)
}

export interface HostBucket { sizeBytes: number; reclaimableBytes: number }
export interface HostStats { at: string; images: HostBucket; buildCache: HostBucket; volumes: HostBucket; containers: HostBucket; reclaimableBytes: number }
const TYPES: Record<string, keyof Pick<HostStats, 'images' | 'buildCache' | 'volumes' | 'containers'>> = { Images: 'images', 'Build Cache': 'buildCache', 'Local Volumes': 'volumes', Containers: 'containers' }
const MAX_ROWS = 50

/** `host-stats.json` assaini : types connus seulement (aucun nom d'image, aucun chemin), tailles en octets, schéma 1. */
export function parseHostStats(raw: unknown): HostStats | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as { schema?: unknown; at?: unknown; rows?: unknown }
  if (o.schema !== 1 || typeof o.at !== 'string' || !Number.isFinite(Date.parse(o.at)) || !Array.isArray(o.rows)) return null
  const empty = (): HostBucket => ({ sizeBytes: 0, reclaimableBytes: 0 })
  const out: HostStats = { at: o.at.slice(0, 40), images: empty(), buildCache: empty(), volumes: empty(), containers: empty(), reclaimableBytes: 0 }
  for (const r of o.rows.slice(0, MAX_ROWS)) {
    if (!r || typeof r !== 'object') continue
    const row = r as { type?: unknown; size?: unknown; reclaimable?: unknown }
    const key = typeof row.type === 'string' ? TYPES[row.type] : undefined
    if (!key) continue
    out[key] = { sizeBytes: parseDockerSize(row.size) ?? 0, reclaimableBytes: parseDockerSize(row.reclaimable) ?? 0 }
  }
  // Les volumes ne sont jamais « récupérables » : on ne les compte pas, même si Docker les signale.
  out.reclaimableBytes = out.images.reclaimableBytes + out.buildCache.reclaimableBytes + out.containers.reclaimableBytes
  return out
}
