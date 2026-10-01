import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  service: { findUnique: vi.fn() }, process: { findUnique: vi.fn() },
  contractService: { findUnique: vi.fn() }, beneficiary: { findUnique: vi.fn() },
  usage: { create: vi.fn() },
}))
const auth = vi.hoisted(() => ({ role: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'user1', role: 'ADMIN' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  tierService: db.service, processus: db.process, tierContractService: db.contractService,
  tierContractBeneficiary: db.beneficiary, tierServiceUsage: db.usage,
} }))
vi.mock('@/lib/org-context.server', () => ({ getEffectiveRoleForOrg: auth.role }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ reglementaireActive: true })) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn(() => '127.0.0.1') }))

import { POST } from '@/app/api/tiers/services/[id]/usages/route'

const ctx = { params: Promise.resolve({ id: 'service1' }) }
const request = (body: object) => ({ json: async () => body }) as never
const body = { organizationId: 'sub1', processusId: 'process1', contractServiceId: 'coverage1', useCase: 'Signature des contrats RH' }

beforeEach(() => {
  vi.clearAllMocks()
  auth.role.mockResolvedValue('ADMIN')
  db.service.findUnique.mockResolvedValue({ id: 'service1', tierId: 'tier1', actif: true, tier: { rootOrganizationId: 'group', organizations: [{ organizationId: 'sub1' }] } })
  db.process.findUnique.mockResolvedValue({ id: 'process1', organizationId: 'sub1' })
  db.contractService.findUnique.mockResolvedValue({ id: 'coverage1', arrangementId: 'contract1', tierServiceId: 'service1', arrangement: { organizationId: 'group', tierId: 'tier1' } })
  db.beneficiary.findUnique.mockResolvedValue({ arrangementId: 'contract1', organizationId: 'sub1', status: 'CONFIRMED' })
  db.usage.create.mockImplementation(async ({ data }: { data: object }) => ({ id: 'usage1', ...data }))
})

describe('usages locaux d’une offre de tiers', () => {
  it('crée plusieurs cas métier distincts pour la même offre et le même contrat', async () => {
    const first = await POST(request(body), ctx)
    const second = await POST(request({ ...body, useCase: 'Signature des achats' }), ctx)
    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(db.usage.create).toHaveBeenCalledTimes(2)
    expect(db.usage.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ useCase: 'Signature des achats' }) }))
  })

  it('conserve un usage sans contrat mais le marque explicitement non couvert', async () => {
    const res = await POST(request({ organizationId: 'sub1', useCase: 'Signature des avenants' }), ctx)
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ coverage: 'UNCONFIRMED' })
  })

  it('refuse un contrat groupe non confirmé et un processus d’une autre filiale', async () => {
    db.beneficiary.findUnique.mockResolvedValue({ arrangementId: 'contract1', organizationId: 'sub1', status: 'PROPOSED' })
    expect((await POST(request(body), ctx)).status).toBe(409)
    db.beneficiary.findUnique.mockResolvedValue({ arrangementId: 'contract1', organizationId: 'sub1', status: 'CONFIRMED' })
    db.process.findUnique.mockResolvedValue({ id: 'process1', organizationId: 'another' })
    expect((await POST(request(body), ctx)).status).toBe(400)
    expect(db.usage.create).not.toHaveBeenCalled()
  })

  it('refuse le service ou le contrat hors périmètre et un rôle non ADMIN', async () => {
    auth.role.mockResolvedValue('LECTEUR')
    expect((await POST(request(body), ctx)).status).toBe(403)
    auth.role.mockResolvedValue('ADMIN')
    db.contractService.findUnique.mockResolvedValue({ id: 'coverage1', arrangementId: 'contract1', tierServiceId: 'other', arrangement: { organizationId: 'group', tierId: 'tier1' } })
    expect((await POST(request(body), ctx)).status).toBe(404)
    db.contractService.findUnique.mockResolvedValue({ id: 'coverage1', arrangementId: 'contract1', tierServiceId: 'service1', arrangement: { organizationId: 'group', tierId: 'tier1' } })
    db.service.findUnique.mockResolvedValue({ id: 'service1', tierId: 'tier1', actif: true, tier: { rootOrganizationId: 'group', organizations: [] } })
    expect((await POST(request(body), ctx)).status).toBe(403)
    expect(db.usage.create).not.toHaveBeenCalled()
  })
})
