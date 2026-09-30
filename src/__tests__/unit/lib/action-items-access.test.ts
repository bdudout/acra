import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  analyseFindMany: vi.fn(), mesureFindMany: vi.fn(), planFindMany: vi.fn(),
  traitementFindMany: vi.fn(), constatFindMany: vi.fn(), executionFindMany: vi.fn(), incidentFindMany: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  analyse: { findMany: m.analyseFindMany }, mesure: { findMany: m.mesureFindMany },
  planAction: { findMany: m.planFindMany }, conformiteTraitement: { findMany: m.traitementFindMany },
  auditConstat: { findMany: m.constatFindMany }, controleExecution: { findMany: m.executionFindMany },
  incident: { findMany: m.incidentFindMany },
} }))

import { gatherActionItems } from '@/lib/action-items.server'

const modules = { incidentsActive: false, controlePermanentActive: false, auditInterneActive: false, registreRisquesActive: false, conformiteActive: false }
const access = { userId: 'analyst', role: 'ANALYSTE' as const, scope: { visibleOrgIds: ['org'], isSuperAdmin: false } }

beforeEach(() => {
  vi.clearAllMocks()
  m.analyseFindMany.mockResolvedValue([])
  m.mesureFindMany.mockResolvedValue([])
  m.planFindMany.mockResolvedValue([])
})

describe('gatherActionItems — WSTG-ATHZ-02/04', () => {
  it('limite les mesures et actions de risque aux analyses accessibles et actives', async () => {
    m.analyseFindMany.mockImplementation(async (query: { where: { id?: unknown } }) =>
      query.where.id ? [] : [{ id: 'shared' }],
    )
    await gatherActionItems('org', modules, access)

    const accessible = m.analyseFindMany.mock.calls[0][0].where
    expect(accessible).toMatchObject({ organizationId: 'org', deletedAt: null, OR: [
      { userId: 'analyst' }, { accesUtilisateurs: { some: { userId: 'analyst' } } },
    ] })
    expect(m.mesureFindMany.mock.calls[0][0].where).toMatchObject({ analyseId: { in: ['shared'] } })
    expect(m.analyseFindMany.mock.calls[1][0].where).toMatchObject({ id: { in: ['shared'] } })
    const linkedPlans = m.planFindMany.mock.calls.find(([query]) => query.where.liens?.some?.type === 'RISQUE_ANALYSE')?.[0]
    expect(linkedPlans?.where.liens.some.ref).toEqual({ in: ['shared'] })
  })

  it('ne charge aucun contenu d’analyse si le lecteur ne voit aucune analyse', async () => {
    await gatherActionItems('org', modules, { ...access, role: 'LECTEUR' })
    expect(m.mesureFindMany.mock.calls[0][0].where.analyseId).toEqual({ in: [] })
    expect(m.analyseFindMany.mock.calls[1][0].where.id).toEqual({ in: [] })
  })
})
