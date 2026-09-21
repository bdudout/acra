// Outil propose_risk : dépose une proposition (ne crée PAS de risque). Org-scopé :
// analyse hors périmètre → introuvable (isError), sans divulgation.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const analyseFindFirst = vi.fn()
const proposalCreate = vi.fn()
const risqueCreate = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    analyse: { findFirst: (...a: unknown[]) => analyseFindFirst(...a) },
    mcpProposal: { create: (...a: unknown[]) => proposalCreate(...a) },
    risque: { create: (...a: unknown[]) => risqueCreate(...a) },
  },
}))

import { proposeRiskTool, proposeMeasureTool } from '@/lib/mcp/tools-propose.server'

const ctx = { organizationId: 'orgA', keyId: 'key1' }
const parse = (r: { content: { text: string }[] }) => JSON.parse(r.content[0].text)

beforeEach(() => { analyseFindFirst.mockReset(); proposalCreate.mockReset(); risqueCreate.mockReset() })

describe('propose_risk', () => {
  it('analyse hors organisation → isError, aucune écriture', async () => {
    analyseFindFirst.mockResolvedValue(null)
    const res = await proposeRiskTool.handler({ analyseId: 'other', risque: { nom: 'X' } }, ctx)
    expect(res.isError).toBe(true)
    // La requête d'existence est bornée à l'organisation de la clé.
    expect(analyseFindFirst.mock.calls[0][0].where).toMatchObject({ id: 'other', organizationId: 'orgA' })
    expect(proposalCreate).not.toHaveBeenCalled()
    expect(risqueCreate).not.toHaveBeenCalled()
  })

  it('proposition valide → crée une McpProposal EN_ATTENTE (pas de risque réel)', async () => {
    analyseFindFirst.mockResolvedValue({ id: 'an1' })
    proposalCreate.mockResolvedValue({ id: 'prop1', statut: 'EN_ATTENTE' })
    const res = await proposeRiskTool.handler({ analyseId: 'an1', risque: { nom: 'Rançongiciel', gravite: 4, vraisemblance: 3 } }, ctx)
    expect(res.isError).toBeUndefined()
    const data = proposalCreate.mock.calls[0][0].data
    expect(data).toMatchObject({ organizationId: 'orgA', apiKeyId: 'key1', type: 'risk', targetType: 'ANALYSE', targetId: 'an1', statut: 'EN_ATTENTE' })
    expect(data.payload).toMatchObject({ nom: 'Rançongiciel', niveauRisque: 12 }) // 4×3 recalculé
    expect(risqueCreate).not.toHaveBeenCalled() // JAMAIS de mutation directe
    expect(parse(res)).toMatchObject({ proposalId: 'prop1', statut: 'EN_ATTENTE' })
  })

  it('proposition sans nom → isError, pas de création', async () => {
    analyseFindFirst.mockResolvedValue({ id: 'an1' })
    const res = await proposeRiskTool.handler({ analyseId: 'an1', risque: { nom: '   ' } }, ctx)
    expect(res.isError).toBe(true)
    expect(proposalCreate).not.toHaveBeenCalled()
  })
})

describe('propose_measure', () => {
  it('valide → crée une McpProposal type "measure" EN_ATTENTE (pas de mesure réelle)', async () => {
    analyseFindFirst.mockResolvedValue({ id: 'an1' })
    proposalCreate.mockResolvedValue({ id: 'prop2', statut: 'EN_ATTENTE' })
    const res = await proposeMeasureTool.handler({ analyseId: 'an1', mesure: { nom: 'MFA', type: 'BOGUS', priorite: 1 } }, ctx)
    expect(res.isError).toBeUndefined()
    const data = proposalCreate.mock.calls[0][0].data
    expect(data).toMatchObject({ organizationId: 'orgA', apiKeyId: 'key1', type: 'measure', targetType: 'ANALYSE', targetId: 'an1', statut: 'EN_ATTENTE' })
    expect(data.payload).toMatchObject({ nom: 'MFA', type: 'PREVENTIVE', priorite: 1 }) // type inconnu normalisé
  })

  it('analyse hors organisation → isError, aucune écriture', async () => {
    analyseFindFirst.mockResolvedValue(null)
    const res = await proposeMeasureTool.handler({ analyseId: 'other', mesure: { nom: 'X' } }, ctx)
    expect(res.isError).toBe(true)
    expect(proposalCreate).not.toHaveBeenCalled()
  })
})
