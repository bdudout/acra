import { beforeEach, it, expect, vi } from 'vitest'
const { tx, transaction } = vi.hoisted(() => {
 const tx = {
  organization: { findUnique: vi.fn() },
  $queryRaw: vi.fn(async () => []),
  analyse: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
  cadrage: { create: vi.fn() },
  sourceRisque: { createMany: vi.fn() }, partiePrenante: { createMany: vi.fn() },
  scenarioStrategique: { createMany: vi.fn() }, scenarioOperationnel: { createMany: vi.fn() },
  risque: { createMany: vi.fn() }, mesure: { createMany: vi.fn() },
 }
 return { tx, transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) }
})
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: transaction } }))
import { createExampleAnalyse } from '@/lib/demo-example'
beforeEach(() => {
 vi.clearAllMocks()
 tx.analyse.findFirst.mockResolvedValue(null)
 tx.analyse.count.mockResolvedValue(0)
 tx.analyse.create.mockResolvedValue({ id: 'a', nom: 'example' })
 tx.cadrage.create.mockResolvedValue({})
})
it('ne crée rien si le quota est atteint', async () => {
 tx.analyse.count.mockResolvedValue(2)
 await expect(createExampleAnalyse('u', 'org', 2)).rejects.toThrow('DEMO_ANALYSIS_LIMIT')
 expect(tx.analyse.create).not.toHaveBeenCalled()
})
it('retourne un exemple existant même au plafond', async () => {
 tx.analyse.findFirst.mockResolvedValue({ id: 'a', nom: 'example' })
 expect(await createExampleAnalyse('u', 'org', 2)).toMatchObject({ alreadyExisted: true })
 expect(tx.analyse.create).not.toHaveBeenCalled()
})
it('crée les cinq ateliers dans une transaction, verrouillée par organisation', async () => {
 expect(await createExampleAnalyse('u', 'org', 2)).toMatchObject({ alreadyExisted: false })
 expect(transaction).toHaveBeenCalledOnce()
 expect(tx.$queryRaw).toHaveBeenCalledOnce()
 expect(tx.mesure.createMany).toHaveBeenCalledOnce()
})
it('propage un échec pour annuler la transaction', async () => {
 tx.cadrage.create.mockRejectedValueOnce(new Error('storage failed'))
 await expect(createExampleAnalyse('u', 'org', 2)).rejects.toThrow('storage failed')
 expect(tx.mesure.createMany).not.toHaveBeenCalled()
})
