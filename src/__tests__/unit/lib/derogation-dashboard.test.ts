import { describe, expect, it } from 'vitest'
import { buildDerogationDashboard } from '@/lib/derogation-dashboard'

describe('buildDerogationDashboard', () => {
  it('sépare les dérogations actives, à échéance proche, expirées et en validation', () => {
    const now = new Date('2026-09-20T00:00:00Z')
    expect(buildDerogationDashboard([
      { statut: 'ACTIVE', dateFin: '2026-12-01' },
      { statut: 'ACTIVE', dateFin: '2026-09-25' },
      { statut: 'ACTIVE', dateFin: '2026-09-01' },
      { statut: 'DEMANDEE', dateFin: null },
    ], 30, now)).toEqual({ active: 1, expiringSoon: 1, expired: 1, pending: 1, total: 4 })
  })

  it('ne présente pas les dérogations terminales comme en revue', () => {
    expect(buildDerogationDashboard([
      { statut: 'REJETEE', dateFin: null },
      { statut: 'CLOTUREE', dateFin: null },
      { statut: 'REVOQUEE', dateFin: null },
      { statut: 'DOUBLE_REGARD', dateFin: null },
      { statut: 'VALIDATION_METIER', dateFin: null },
    ], 30, new Date('2026-09-20T00:00:00Z'))).toEqual({
      active: 0, expiringSoon: 0, expired: 0, pending: 2, total: 5,
    })
  })
})
