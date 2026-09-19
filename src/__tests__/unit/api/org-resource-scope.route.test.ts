import { beforeEach, it, expect, vi } from 'vitest'
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: vi.fn(), getEffectiveRoleForOrg: vi.fn() }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn() }))
vi.mock('@/lib/referentiel.server', () => ({ getExigencesFor: vi.fn(), listReferentiels: vi.fn() }))
vi.mock('@/lib/promotable-actions.server', () => ({ gatherPromotableActions: vi.fn() }))
vi.mock('@/lib/soa-pptx', () => ({ renderSoaPptx: vi.fn() }))
import { getAnalyseScope } from '@/lib/org-context.server'
import { GET as conformite } from '@/app/api/organizations/[orgId]/conformite/route'
import { GET as soa } from '@/app/api/organizations/[orgId]/conformite/soa/route'
import { GET as suivis } from '@/app/api/organizations/[orgId]/conformite/suivis/route'
import { GET as traitements } from '@/app/api/organizations/[orgId]/conformite/traitements/route'
import { GET as plans } from '@/app/api/organizations/[orgId]/plans-actions/route'
import { GET as promotable } from '@/app/api/organizations/[orgId]/action-items/promotable/route'
beforeEach(() => vi.clearAllMocks())
for (const [name, handler] of Object.entries({ conformite, soa, suivis, traitements, plans, promotable })) {
 it.each([
  { visibleOrgIds: [], isSuperAdmin: false, target: 'foreign' },
  { visibleOrgIds: [], isSuperAdmin: false, target: 'global' },
  { visibleOrgIds: ['own'], isSuperAdmin: false, target: 'foreign' },
  { visibleOrgIds: ['own'], isSuperAdmin: false, target: 'global' },
 ])(`${name} refuse le périmètre interdit %j avant toute lecture métier`, async ({ target, ...scope }) => {
  vi.mocked(getAnalyseScope).mockResolvedValue({ scope } as never)
  const res = await handler(new Request('http://localhost/api?referentiel=ISO27001') as never, { params: Promise.resolve({ orgId: target }) })
  expect(res.status).toBe(403)
 })
}
