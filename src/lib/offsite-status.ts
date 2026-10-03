// ─── État de la sauvegarde externe (PUR) — docs/specs/sauvegarde-externe-proposition.md ───
// `.acra-update/offsite.json`, publié par scripts/acra-offsite.sh : l'application ne lit que ce fichier (lecture seule,
// aucune commande lancée). Aucune cible, aucun chemin, aucun identifiant n'y figure.

import { isSnapshotId } from '@/lib/snapshot'

export const OFFSITE_DRIVERS = ['fs', 'command', 's3', 'none'] as const
export type OffsiteDriver = (typeof OFFSITE_DRIVERS)[number]
export interface OffsiteState { driver: OffsiteDriver; lastSnapshotId: string | null; lastSuccessAt: string | null; lastFailureAt: string | null; lastCode: number }
export type OffsiteStatus = 'OK' | 'LATE' | 'FAILED' | 'NONE'
export const OFFSITE_DEFAULT_MAX_AGE_HOURS = 48

const iso = (v: unknown): string | null => (typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v)) ? v : null)

export function parseOffsiteState(raw: unknown): OffsiteState | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.schema !== 1) return null
  if (!(OFFSITE_DRIVERS as readonly unknown[]).includes(o.driver)) return null
  if (typeof o.lastCode !== 'number' || !Number.isInteger(o.lastCode) || o.lastCode < 0 || o.lastCode > 255) return null
  return { driver: o.driver as OffsiteDriver, lastSnapshotId: isSnapshotId(o.lastSnapshotId) ? o.lastSnapshotId : null, lastSuccessAt: iso(o.lastSuccessAt), lastFailureAt: iso(o.lastFailureAt), lastCode: o.lastCode }
}

/** Verdict : échec (dernier succès absent ou antérieur au dernier échec), retard (âge > seuil) ou OK. */
export function offsiteHealth(s: OffsiteState | null, now: Date, maxAgeHours = OFFSITE_DEFAULT_MAX_AGE_HOURS): { status: OffsiteStatus; ageHours?: number } {
  if (!s) return { status: 'NONE' }
  if (!s.lastSuccessAt) return { status: 'FAILED' }
  const ok = Date.parse(s.lastSuccessAt)
  if (s.lastFailureAt && Date.parse(s.lastFailureAt) > ok) return { status: 'FAILED', ageHours: Math.floor((now.getTime() - ok) / 3_600_000) }
  const ageHours = Math.floor((now.getTime() - ok) / 3_600_000)
  return { status: ageHours > maxAgeHours ? 'LATE' : 'OK', ageHours }
}
