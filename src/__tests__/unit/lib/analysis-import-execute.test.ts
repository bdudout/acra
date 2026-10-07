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

import { analysisImportPayloadHash, applyAnalysisImportContent, executeAnalysisImport, parseAnalysisImportRequest } from '@/lib/analysis-import'

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

  // Faux client transactionnel : enregistre les écritures pour inspection.
  function fakeTx() {
    let n = 0
    const liens: Record<string, unknown>[] = []
    const tx = {
      analyse: { create: vi.fn(async () => ({ id: 'an-1', nom: 'PRA' })) },
      risque: { create: vi.fn(async () => ({ id: `risk-${++n}` })), update: vi.fn(async () => ({})) },
      mesure: { create: vi.fn(async () => ({})), createMany: vi.fn(async () => ({ count: 0 })) },
      planAction: { create: vi.fn(async () => ({ id: `pa-${++n}` })) },
      planActionLien: { create: vi.fn(async (a: { data: Record<string, unknown> }) => { liens.push(a.data); return {} }) },
      analysisImport: { create: vi.fn(async () => ({ id: 'imp-1' })) },
    }
    return { tx, liens }
  }
  const withLinks = () => parseAnalysisImportRequest({
    idempotencyKey: 'import-liens-2026-0001',
    analysis: { title: 'PRA' },
    risks: [{ externalId: 'R1', title: 'Rançongiciel' }, { externalId: 'R2', title: 'Fuite' }],
    actions: [{ externalId: 'A1', title: 'MFA', riskExternalId: 'R1' }, { externalId: 'A2', title: 'Sauvegardes' }],
    links: [{ riskExternalId: 'R2', actionExternalId: 'A2' }],
  })

  it('création (méthode à saisie directe) : secteur, sous-secteurs cohérents, périmètre et objectifs repris dans le cadrage', async () => {
    const { tx } = fakeTx()
    findUnique.mockResolvedValue(null)
    transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))
    const input = parseAnalysisImportRequest({
      idempotencyKey: 'import-contexte-2026-01',
      analysis: { title: 'Portail', secteur: 'Santé / Médico-social', sousSecteurs: ['sante-amc', 'banque-detail'] },
      context: { perimetre: 'Portail adhérents', objectifs: 'Souscription en ligne' },
    })
    await executeAnalysisImport(input, { organizationId: 'org-a', userId: 'user-a', source: 'MCP' })
    const data = (tx.analyse.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data
    expect(data).toMatchObject({ secteur: 'Santé / Médico-social', sousSecteurs: ['sante-amc'], cadrage: { create: { perimetre: 'Portail adhérents', objectifsEtude: 'Souscription en ligne' } } })
  })

  it('import : chaque lien RISQUE_ANALYSE porte ref = analyseId (compteurs et liens profonds)', async () => {
    const { tx, liens } = fakeTx()
    findUnique.mockResolvedValue(null)
    transaction.mockImplementation(async (fn: (t: unknown) => unknown, opts?: { timeout?: number }) => { expect(opts?.timeout).toBeGreaterThanOrEqual(30_000); return fn(tx) })
    await executeAnalysisImport(withLinks(), { organizationId: 'org-a', userId: 'user-a', source: 'EXCEL_WEB' })
    expect(liens).toHaveLength(2)
    for (const l of liens) expect(l).toMatchObject({ type: 'RISQUE_ANALYSE', ref: 'an-1' })
  })

  it('risques résiduels : cotations actuelle et résiduelle rattachées aux risques par référence (VM02 = VM_02 : écriture canonique)', async () => {
    const { tx } = fakeTx()
    transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))
    const input = parseAnalysisImportRequest({
      idempotencyKey: 'import-residuel-2026-01', analysis: { title: 'PRA' },
      risks: [{ externalId: 'RI_01', title: 'Usurpation' }, { externalId: 'RI_02', title: 'Fuite' }],
      residualRisks: [
        { riskExternalId: 'RI01', currentGravity: 3, currentLikelihood: 2, residualGravity: 3, residualLikelihood: 1 },
        { riskExternalId: 'RI_99', residualGravity: 2, residualLikelihood: 2 },
      ],
    })
    await applyAnalysisImportContent(input, { organizationId: 'org-a', userId: 'user-a', analyseId: 'an-1' })
    expect(tx.risque.update).toHaveBeenCalledTimes(1)
    expect(tx.risque.update).toHaveBeenCalledWith({ where: { id: 'risk-1' }, data: { graviteActuelle: 3, vraisemblanceActuelle: 2, niveauActuel: 6, graviteResiduelle: 3, vraisemblanceResiduelle: 1, niveauResiduel: 3 } })
  })

  it('application MCP sur une analyse existante : même contrat de lien', async () => {
    const { tx, liens } = fakeTx()
    transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))
    await applyAnalysisImportContent(withLinks(), { organizationId: 'org-a', userId: 'user-a', analyseId: 'an-existant' })
    expect(liens).toHaveLength(2)
    for (const l of liens) expect(l).toMatchObject({ type: 'RISQUE_ANALYSE', ref: 'an-existant' })
  })
})
