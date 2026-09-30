// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ findMany: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn(), rateLimitHeaders: () => ({}), LIMIT_API_WRITE: { limit: 1, windowMs: 1 } }))
vi.mock('@/lib/prisma', () => ({ prisma: { tierOrganization: { findMany: m.findMany, findUnique: vi.fn() } } }))
import { sanitizeTierLinks } from '@/lib/tier-registry.server'

beforeEach(() => { vi.clearAllMocks(); m.findMany.mockResolvedValue([{ tierId: 't1' }]) })

describe('sanitizeTierLinks — liens parties prenantes → identités de tiers', () => {
  it('garde les tiers autorisés pour l’organisation de l’analyse, détache les autres et les compte (la sauvegarde ne doit jamais échouer)', async () => {
    const rows = [{ nom: 'A', tierId: 't1' }, { nom: 'B', tierId: 'tEtranger' }, { nom: 'C', tierId: null }]
    const out = await sanitizeTierLinks(rows, 'org1')
    expect(out.rows.map(r => r.tierId)).toEqual(['t1', null, null])
    expect(out.dropped).toBe(1)
    expect(m.findMany.mock.calls[0][0].where).toEqual({ organizationId: 'org1', tierId: { in: ['t1', 'tEtranger'] } })
  })
  it('aucun lien demandé : aucune requête ; analyse sans organisation : tous les liens sont détachés', async () => {
    expect((await sanitizeTierLinks([{ nom: 'A', tierId: null }], 'org1')).dropped).toBe(0)
    expect(m.findMany).not.toHaveBeenCalled()
    const out = await sanitizeTierLinks([{ nom: 'A', tierId: 't1' }], null)
    expect(out.rows[0].tierId).toBeNull(); expect(out.dropped).toBe(1)
  })
})
