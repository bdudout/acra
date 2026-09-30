import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  arrangement: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn() },
  membership: { findFirst: vi.fn() },
  beneficiary: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  tierOrganization: { upsert: vi.fn() },
  queryRaw: vi.fn(),
  transaction: vi.fn(),
}))
const auth = vi.hoisted(() => ({ role: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'user1', role: 'ADMIN' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getEffectiveRoleForOrg: auth.role }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ reglementaireActive: true })) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn(() => '127.0.0.1') }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  arrangementTic: db.arrangement, organization: db.organization,
  orgMembership: db.membership, $transaction: db.transaction,
} }))

import { POST } from '@/app/api/tiers/contracts/[id]/beneficiaries/route'
import { PATCH } from '@/app/api/tiers/contracts/[id]/beneficiaries/[orgId]/route'

const context = { params: Promise.resolve({ id: 'contract1', orgId: 'sub1' }) }
const request = (body: object) => ({ json: async () => body }) as never

beforeEach(() => {
  vi.clearAllMocks()
  db.arrangement.findUnique.mockResolvedValue({ id: 'contract1', organizationId: 'group', tierId: 'tier1', tier: { rootOrganizationId: 'group' } })
  db.organization.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === 'group' ? { id: 'group', path: '/group/' } : { id: 'sub1', path: '/group/sub1/' })
  auth.role.mockResolvedValue('ADMIN')
  db.membership.findFirst.mockResolvedValue({ role: 'ADMIN' })
  db.beneficiary.findUnique.mockResolvedValue(null)
  db.beneficiary.upsert.mockResolvedValue({ arrangementId: 'contract1', organizationId: 'sub1', status: 'PROPOSED' })
  db.beneficiary.update.mockResolvedValue({ arrangementId: 'contract1', organizationId: 'sub1', status: 'CONFIRMED' })
  db.tierOrganization.upsert.mockResolvedValue({ tierId: 'tier1', organizationId: 'sub1' })
  db.queryRaw.mockResolvedValue([])
  db.transaction.mockImplementation(async (run: (tx: unknown) => Promise<unknown>) => run({
    tierContractBeneficiary: db.beneficiary, tierOrganization: db.tierOrganization, $queryRaw: db.queryRaw,
  }))
})

describe('couverture d’un contrat groupe', () => {
  it('l’ADMIN groupe propose, sans accorder encore l’accès à la filiale', async () => {
    const res = await POST(request({ organizationId: 'sub1' }), context)
    expect(res.status).toBe(201)
    expect(db.transaction).toHaveBeenCalledOnce()
    expect(db.beneficiary.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ status: 'PROPOSED' }),
    }))
    expect(db.tierOrganization.upsert).not.toHaveBeenCalled()
  })

  it('ne propose pas le contrat à une organisation hors du groupe', async () => {
    db.organization.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === 'group' ? { id: 'group', path: '/group/' } : { id: 'sub1', path: '/another/sub1/' })
    const res = await POST(request({ organizationId: 'sub1' }), context)
    expect(res.status).toBe(404)
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('refuse de partager un Tier rattaché à un autre groupe', async () => {
    db.arrangement.findUnique.mockResolvedValue({ id: 'contract1', organizationId: 'group', tierId: 'tier1', tier: { rootOrganizationId: 'another' } })
    expect((await POST(request({ organizationId: 'sub1' }), context)).status).toBe(404)
    expect((await PATCH(request({ decision: 'CONFIRM' }), context)).status).toBe(404)
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('refuse la proposition si le rôle effectif au groupe n’est pas ADMIN', async () => {
    auth.role.mockResolvedValue('LECTEUR')
    const res = await POST(request({ organizationId: 'sub1' }), context)
    expect(res.status).toBe(403)
    expect(db.organization.findUnique).toHaveBeenCalledTimes(1)
    expect(db.beneficiary.upsert).not.toHaveBeenCalled()
  })

  it('la confirmation exige une appartenance ADMIN directe à la filiale', async () => {
    db.membership.findFirst.mockResolvedValue(null)
    const res = await PATCH(request({ decision: 'CONFIRM' }), context)
    expect(res.status).toBe(403)
    expect(db.beneficiary.update).not.toHaveBeenCalled()
  })

  it('la confirmation rend le Tier visible à la filiale dans la même transaction', async () => {
    db.beneficiary.findUnique.mockResolvedValue({ arrangementId: 'contract1', organizationId: 'sub1', status: 'PROPOSED' })
    const res = await PATCH(request({ decision: 'CONFIRM' }), context)
    expect(res.status).toBe(200)
    expect(db.beneficiary.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'CONFIRMED' }),
    }))
    expect(db.tierOrganization.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tierId_organizationId: { tierId: 'tier1', organizationId: 'sub1' } },
    }))
  })

  it('un refus conserve la décision mais ne rend pas le Tier visible', async () => {
    db.beneficiary.findUnique.mockResolvedValue({ arrangementId: 'contract1', organizationId: 'sub1', status: 'PROPOSED' })
    const res = await PATCH(request({ decision: 'REJECT' }), context)
    expect(res.status).toBe(200)
    expect(db.beneficiary.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'REJECTED', confirmedById: null }),
    }))
    expect(db.tierOrganization.upsert).not.toHaveBeenCalled()
  })

  it('ne confirme pas deux fois une proposition déjà tranchée', async () => {
    db.beneficiary.findUnique.mockResolvedValue({ arrangementId: 'contract1', organizationId: 'sub1', status: 'CONFIRMED' })
    const res = await PATCH(request({ decision: 'CONFIRM' }), context)
    expect(res.status).toBe(409)
    expect(db.beneficiary.update).not.toHaveBeenCalled()
  })
})
