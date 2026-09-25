import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const { findUnique, transaction } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { analysisImport: { findUnique }, $transaction: transaction },
}))
vi.mock('@/lib/interfaces-config.server', () => ({ getActiveMethodes: vi.fn().mockResolvedValue(['ISO_31000']) }))
vi.mock('@/lib/methodes', () => ({ resolveMethodes: vi.fn().mockReturnValue({ available: ['ISO_31000'], default: 'ISO_31000' }) }))

import { analysisImportPayloadHash, executeAnalysisImport, parseAnalysisImportRequest } from '@/lib/analysis-import'

describe('executeAnalysisImport', () => {
  beforeEach(() => { findUnique.mockReset(); transaction.mockReset() })

  it('retourne le reçu gagnant lorsqu’un même import est créé concurremment', async () => {
    const input = parseAnalysisImportRequest({
      idempotencyKey: 'concurrent-import-2026-001',
      analysis: { title: 'PRA' },
    })
    const receipt = {
      id: 'import-existing', payloadHash: analysisImportPayloadHash(input),
      response: { analyseId: 'analyse-existing', nom: 'PRA', created: { risks: 0, vulnerabilities: 0, measures: 0, actions: 0 } },
    }
    transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' }))
    findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(receipt)

    await expect(executeAnalysisImport(input, { organizationId: 'org-a', userId: 'user-a', source: 'API_V2' }))
      .resolves.toMatchObject({ replayed: true, importId: 'import-existing', analyseId: 'analyse-existing' })
  })
})
