import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  analyse: { findFirst: vi.fn() },
  riskItem: { findMany: vi.fn(), createMany: vi.fn(), update: vi.fn() },
  transaction: vi.fn(), queryRaw: vi.fn(),
}))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: 'RISK_MANAGER' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  analyse: db.analyse, riskItem: db.riskItem,
  $transaction: db.transaction,
} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: vi.fn(async () => ({ role: 'RISK_MANAGER', activeOrgId: 'org1' })) }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ registreRisquesActive: true })) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn(() => '127.0.0.1') }))

import { POST } from '@/app/api/risk-items/publish/route'

const req = () => ({ json: async () => ({ analyseId: 'analyse1' }) }) as never

beforeEach(() => {
  vi.clearAllMocks()
  db.analyse.findFirst.mockResolvedValue({
    id: 'analyse1', nom: 'Analyse', organisation: 'Entité', statut: 'APPROUVE',
    risques: [{ id: 'source1', nom: 'Risque', description: null, gravite: 3, vraisemblance: 2, graviteResiduelle: null, vraisemblanceResiduelle: null }],
  })
  db.riskItem.findMany.mockResolvedValue([])
  db.riskItem.createMany.mockResolvedValue({ count: 1 })
  db.riskItem.update.mockResolvedValue({ id: 'r1' })
  db.queryRaw.mockResolvedValue([{ pg_advisory_xact_lock: null }])
  db.transaction.mockImplementation(async (run: (tx: unknown) => Promise<unknown>) => run({
    riskItem: db.riskItem, $queryRaw: db.queryRaw,
  }))
})

describe('POST /api/risk-items/publish — publication idempotente', () => {
  it('verrouille la provenance dans une transaction avant de lire puis créer les RiskItem', async () => {
    const order: string[] = []
    db.queryRaw.mockImplementation(async () => { order.push('lock'); return [] })
    db.riskItem.findMany.mockImplementation(async () => { order.push('read'); return [] })
    db.riskItem.createMany.mockImplementation(async () => { order.push('create'); return { count: 1 } })

    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(db.transaction).toHaveBeenCalledOnce()
    expect(db.queryRaw).toHaveBeenCalledOnce()
    expect(order).toEqual(['lock', 'read', 'create'])
  })

  it('refuse de mettre à jour arbitrairement une provenance déjà dupliquée', async () => {
    db.riskItem.findMany.mockResolvedValue([
      { id: 'r1', sourceId: 'source1' }, { id: 'r2', sourceId: 'source1' },
    ])
    const res = await POST(req())
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'publication_source_dupliquee' })
    expect(db.riskItem.createMany).not.toHaveBeenCalled()
    expect(db.riskItem.update).not.toHaveBeenCalled()
  })

  it('met à jour un risque déjà publié sans en créer un second', async () => {
    db.riskItem.findMany.mockResolvedValue([{ id: 'r1', sourceId: 'source1' }])
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ crees: 0, maj: 1, total: 1 })
    expect(db.riskItem.createMany).not.toHaveBeenCalled()
    expect(db.riskItem.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'r1' },
      data: expect.not.objectContaining({ statut: expect.anything() }),
    }))
  })
})
