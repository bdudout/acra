import { etatDerogation, type DerogationStatut } from '@/lib/derogation'

export interface DerogationDashboardSource { statut: string; dateFin: string | Date | null }
export interface DerogationDashboard { active: number; expiringSoon: number; expired: number; pending: number; total: number }

const REVIEW_STATUSES = new Set<DerogationStatut>(['DEMANDEE', 'DOUBLE_REGARD', 'VALIDATION_METIER'])

/** Agrège les états opérationnels du registre, sans masquer les dérogations expirées. */
export function buildDerogationDashboard(rows: DerogationDashboardSource[], alertDays: number, now = new Date()): DerogationDashboard {
  const result: DerogationDashboard = { active: 0, expiringSoon: 0, expired: 0, pending: 0, total: rows.length }
  for (const row of rows) {
    if (row.statut !== 'ACTIVE') {
      if (REVIEW_STATUSES.has(row.statut as DerogationStatut)) result.pending++
      continue
    }
    const state = etatDerogation({ statut: row.statut as DerogationStatut, dateFin: row.dateFin ? new Date(row.dateFin) : null }, alertDays, now)
    if (state === 'EXPIREE') result.expired++
    else if (state === 'EXPIRE_BIENTOT') result.expiringSoon++
    else result.active++
  }
  return result
}
