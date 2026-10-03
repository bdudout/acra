// ─── Planification des sauvegardes (PUR) ───
// Politique « grand-père / père / fils » : une sauvegarde par jour, par semaine et par mois, chaque fréquence conservant
// `keep` copies. Défaut : les trois actives, 3 copies chacune, à 02 h. L'exécution est assurée par l'agent hôte
// (`scripts/acra-schedule.sh`), jamais par l'application, qui lit/écrit seulement la politique et affiche l'espace.

export const GB = 1024 ** 3

export interface BackupPolicy {
  daily: { enabled: boolean; keep: number }
  weekly: { enabled: boolean; keep: number; weekday: number } // 0 = dimanche … 6 = samedi
  monthly: { enabled: boolean; keep: number; day: number }    // 1 … 28
  hour: number                                                 // 0 … 23, heure locale du serveur
}

export const DEFAULT_BACKUP_POLICY: BackupPolicy = {
  daily: { enabled: true, keep: 3 },
  weekly: { enabled: true, keep: 3, weekday: 0 },
  monthly: { enabled: true, keep: 3, day: 1 },
  hour: 2,
}

const int = (v: unknown, min: number, max: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null)

/** Politique lue d'un fichier : champs invalides ou absents ⇒ valeurs par défaut (jamais d'exception). */
export function parseBackupPolicy(raw: unknown): BackupPolicy {
  const d = DEFAULT_BACKUP_POLICY
  if (!raw || typeof raw !== 'object' || (raw as { schema?: unknown }).schema !== 1) return structuredClone(d)
  const o = raw as { daily?: Record<string, unknown>; weekly?: Record<string, unknown>; monthly?: Record<string, unknown>; hour?: unknown }
  const en = (x: Record<string, unknown> | undefined, def: boolean) => (typeof x?.enabled === 'boolean' ? x.enabled : def)
  return {
    daily: { enabled: en(o.daily, d.daily.enabled), keep: int(o.daily?.keep, 1, 60) ?? d.daily.keep },
    weekly: { enabled: en(o.weekly, d.weekly.enabled), keep: int(o.weekly?.keep, 1, 60) ?? d.weekly.keep, weekday: int(o.weekly?.weekday, 0, 6) ?? d.weekly.weekday },
    monthly: { enabled: en(o.monthly, d.monthly.enabled), keep: int(o.monthly?.keep, 1, 60) ?? d.monthly.keep, day: int(o.monthly?.day, 1, 28) ?? d.monthly.day },
    hour: int(o.hour, 0, 23) ?? d.hour,
  }
}

/** Validation stricte d'une politique proposée par l'interface : liste des champs invalides. */
export function validateBackupPolicy(p: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!p || typeof p !== 'object') return { ok: false, errors: ['policy'] }
  const o = p as { daily?: Record<string, unknown>; weekly?: Record<string, unknown>; monthly?: Record<string, unknown>; hour?: unknown }
  for (const k of ['daily', 'weekly', 'monthly'] as const) {
    if (typeof o[k]?.enabled !== 'boolean') errors.push(`${k}.enabled`)
    if (int(o[k]?.keep, 1, 60) === null) errors.push(`${k}.keep`)
  }
  if (int(o.weekly?.weekday, 0, 6) === null) errors.push('weekly.weekday')
  if (int(o.monthly?.day, 1, 28) === null) errors.push('monthly.day')
  if (int(o.hour, 0, 23) === null) errors.push('hour')
  if (!errors.length && !(o.daily!.enabled || o.weekly!.enabled || o.monthly!.enabled)) errors.push('frequencies')
  return { ok: errors.length === 0, errors }
}

export interface StorageEstimate { scheduledPoints: number; scheduledPointsMin: number; scheduledBytes: number; preUpdateBytes: number; totalBytes: number }

/**
 * Espace occupé en régime établi. Un point planifié = dump + documents (`pointBytes`, sans clone) ; un point de mise à jour
 * = dump + documents + clone de la base. `scheduledPoints` : borne haute (chaque fréquence garde ses propres copies) ;
 * `scheduledPointsMin` : un même point peut servir plusieurs fréquences (jour de semaine/mois confondu), borne basse.
 */
export function estimateStorage(a: { policy: BackupPolicy; pointBytes: number; preUpdateKeep: number; preUpdatePointBytes: number; cloneBytes: number }): StorageEstimate {
  const keeps = (['daily', 'weekly', 'monthly'] as const).filter(k => a.policy[k].enabled).map(k => a.policy[k].keep)
  const scheduledPoints = keeps.reduce((s, k) => s + k, 0)
  const scheduledPointsMin = keeps.length ? Math.max(...keeps) : 0
  const scheduledBytes = scheduledPoints * a.pointBytes
  const preUpdateBytes = a.preUpdateKeep * (a.preUpdatePointBytes + a.cloneBytes)
  return { scheduledPoints, scheduledPointsMin, scheduledBytes, preUpdateBytes, totalBytes: scheduledBytes + preUpdateBytes }
}

export type DiskStatus = 'OK' | 'WARN' | 'CRITICAL' | 'UNKNOWN'
export interface DiskAdvice { status: DiskStatus; missingBytes: number; additionalBytes: number }

/** Compare le besoin (en régime établi) à l'espace libre, en déduisant ce que les sauvegardes occupent déjà. */
export function diskAdvice(a: { freeBytes: number | null; neededBytes: number; usedByBackupsBytes: number; pointBytes: number }): DiskAdvice {
  const additionalBytes = Math.max(0, a.neededBytes - a.usedByBackupsBytes)
  if (a.freeBytes === null) return { status: 'UNKNOWN', missingBytes: 0, additionalBytes }
  const missingBytes = Math.max(0, additionalBytes - a.freeBytes)
  if (missingBytes > 0 || a.freeBytes < a.pointBytes) return { status: 'CRITICAL', missingBytes, additionalBytes }
  // Marge : le besoin supplémentaire ne doit pas consommer plus de la moitié de l'espace libre.
  if (a.freeBytes < 2 * additionalBytes) return { status: 'WARN', missingBytes: 0, additionalBytes }
  return { status: 'OK', missingBytes: 0, additionalBytes }
}

/** Conservation minimale usuelle : 7 quotidiennes, 4 hebdomadaires, 6 mensuelles. */
export const RECOMMENDED_KEEP = { daily: 7, weekly: 4, monthly: 6 } as const
export type PolicyAdviceCode = 'daily_low' | 'weekly_low' | 'monthly_low' | 'no_daily'
export function policyAdvice(p: BackupPolicy): PolicyAdviceCode[] {
  const out: PolicyAdviceCode[] = []
  if (!p.daily.enabled) out.push('no_daily')
  else if (p.daily.keep < RECOMMENDED_KEEP.daily) out.push('daily_low')
  if (p.weekly.enabled && p.weekly.keep < RECOMMENDED_KEEP.weekly) out.push('weekly_low')
  if (p.monthly.enabled && p.monthly.keep < RECOMMENDED_KEEP.monthly) out.push('monthly_low')
  return out
}

/** Prochaines exécutions (heure locale), pour l'aperçu de l'interface. */
export function nextRuns(p: BackupPolicy, now: Date): { daily: Date | null; weekly: Date | null; monthly: Date | null } {
  const at = (d: Date) => { const x = new Date(d); x.setHours(p.hour, 0, 0, 0); return x }
  const daily = p.daily.enabled ? (() => { const t = at(now); if (t <= now) t.setDate(t.getDate() + 1); return t })() : null
  const weekly = p.weekly.enabled ? (() => { const t = at(now); while (t.getDay() !== p.weekly.weekday || t <= now) t.setDate(t.getDate() + 1); return t })() : null
  const monthly = p.monthly.enabled ? (() => { const t = at(now); t.setDate(p.monthly.day); if (t <= now) { t.setMonth(t.getMonth() + 1); t.setDate(p.monthly.day) } return t })() : null
  return { daily, weekly, monthly }
}
