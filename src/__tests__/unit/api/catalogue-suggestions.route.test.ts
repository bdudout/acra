import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  organization: { findUnique: vi.fn() },
  process: { findMany: vi.fn(), create: vi.fn() },
  risk: { findMany: vi.fn(), create: vi.fn() },
  queryRaw: vi.fn(), transaction: vi.fn(),
}))
const auth = vi.hoisted(() => ({ scope: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'user1', role: 'ADMIN' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  organization: db.organization, processus: db.process, riskItem: db.risk, $transaction: db.transaction,
} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: auth.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ registreRisquesActive: true })) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn(() => '127.0.0.1') }))

import { GET, POST } from '@/app/api/catalogue-suggestions/route'

const request = (body: object) => ({ json: async () => body }) as never

beforeEach(() => {
  vi.clearAllMocks()
  auth.scope.mockResolvedValue({ activeOrgId: 'org1', role: 'ADMIN' })
  db.organization.findUnique.mockResolvedValue({ secteursActivite: ['FINANCE'] })
  db.process.findMany.mockResolvedValue([])
  db.risk.findMany.mockResolvedValue([])
  db.queryRaw.mockResolvedValue([])
  db.process.create.mockImplementation(async ({ data }: { data: { catalogueKey: string } }) => ({ id: `id-${data.catalogueKey}`, ...data }))
  db.risk.create.mockImplementation(async ({ data }: { data: { catalogueKey: string } }) => ({ id: `id-${data.catalogueKey}`, ...data }))
  db.transaction.mockImplementation(async (run: (tx: unknown) => Promise<unknown>) => run({
    processus: db.process, riskItem: db.risk, $queryRaw: db.queryRaw,
  }))
})

describe('catalogue de suggestions — aperçu et import partiel', () => {
  it('prévisualise le secteur de l’organisation et les éléments déjà importés sans écrire', async () => {
    db.process.findMany.mockResolvedValue([{ id: 'p1', catalogueKey: 'core.process.deliver' }])
    const res = await GET(new Request('http://localhost/api/catalogue-suggestions?locale=fr') as never)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.sector).toBe('FINANCE')
    expect(data.items.find((item: { key: string }) => item.key === 'core.process.deliver').status).toBe('ALREADY_IMPORTED')
    expect(data.items.some((item: { key: string }) => item.key === 'finance.risk.payment-routing')).toBe(true)
    expect(db.process.create).not.toHaveBeenCalled()
  })

  it('bloque sans surprise les liens omis, puis importe seulement trois risques explicitement acceptés', async () => {
    const selectedKeys = ['core.risk.payment-fraud', 'core.risk.ransomware', 'core.risk.data-leak']
    const preview = await POST(request({ sector: null, locale: 'fr', selectedKeys }))
    expect(preview.status).toBe(409)
    expect((await preview.json()).unlinked).toHaveLength(3)
    expect(db.risk.create).not.toHaveBeenCalled()
    const accepted = await POST(request({ sector: null, locale: 'fr', selectedKeys, acceptUnlinked: true }))
    expect(accepted.status).toBe(201)
    expect(db.risk.create).toHaveBeenCalledTimes(3)
    expect(db.risk.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      catalogueKey: 'core.risk.payment-fraud', processusId: null, provenance: 'ACRA', statut: 'IDENTIFIE',
    }) }))
  })

  it('crée le processus parent avant l’enfant et relie le risque à son processus, sans cotation', async () => {
    const res = await POST(request({ sector: 'FINANCE', locale: 'fr', selectedKeys: [
      'finance.risk.payment-routing', 'finance.process.payments', 'core.process.deliver',
    ] }))
    expect(res.status).toBe(201)
    expect(db.process.create).toHaveBeenCalledTimes(2)
    expect(db.process.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({
      parentId: 'id-core.process.deliver',
    }) }))
    expect(db.risk.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      processusId: 'id-finance.process.payments', graviteInherente: null,
    }) }))
  })

  it('n’importe pas une clé hors secteur et ne recrée pas une clé déjà présente', async () => {
    const invalid = await POST(request({ sector: 'SANTE', locale: 'fr', selectedKeys: ['finance.risk.payment-routing'] }))
    expect(invalid.status).toBe(400)
    db.risk.findMany.mockResolvedValue([{ id: 'edited', catalogueKey: 'sante.risk.patient-data' }])
    const existing = await POST(request({ sector: 'SANTE', locale: 'fr', selectedKeys: ['sante.risk.patient-data'] }))
    expect(existing.status).toBe(200)
    expect((await existing.json()).alreadyImported).toEqual(['sante.risk.patient-data'])
    expect(db.risk.create).not.toHaveBeenCalled()
  })

  it('interdit la création de processus à un non-admin de l’organisation', async () => {
    auth.scope.mockResolvedValue({ activeOrgId: 'org1', role: 'ANALYSTE' })
    const res = await POST(request({ sector: null, locale: 'fr', selectedKeys: ['core.process.govern'] }))
    expect(res.status).toBe(403)
    expect(db.process.create).not.toHaveBeenCalled()
  })
})
