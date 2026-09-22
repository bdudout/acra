// Outil propose_risk : dépose une proposition (ne crée PAS de risque). Org-scopé :
// analyse hors périmètre → introuvable (isError), sans divulgation.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Existence de l'ancre = prisma.<modèle>.count. On pilote analyse/riskItem.
const analyseCount = vi.fn()
const riskItemCount = vi.fn()
const conformiteCount = vi.fn()
const proposalCreate = vi.fn()
const risqueCreate = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    analyse: { count: (...a: unknown[]) => analyseCount(...a) },
    riskItem: { count: (...a: unknown[]) => riskItemCount(...a) },
    conformite: { count: (...a: unknown[]) => conformiteCount(...a) },
    mcpProposal: { create: (...a: unknown[]) => proposalCreate(...a) },
    risque: { create: (...a: unknown[]) => risqueCreate(...a) },
  },
}))

import { proposeRiskTool, proposeMeasureTool, proposePlanActionTool, proposeConformiteTool } from '@/lib/mcp/tools-propose.server'

const ctx = { organizationId: 'orgA', keyId: 'key1' }
const parse = (r: { content: { text: string }[] }) => JSON.parse(r.content[0].text)

beforeEach(() => { analyseCount.mockReset(); riskItemCount.mockReset(); conformiteCount.mockReset(); proposalCreate.mockReset(); risqueCreate.mockReset() })

describe('propose_risk', () => {
  it('analyse hors organisation → isError, aucune écriture', async () => {
    analyseCount.mockResolvedValue(0)
    const res = await proposeRiskTool.handler({ analyseId: 'other', risque: { nom: 'X' } }, ctx)
    expect(res.isError).toBe(true)
    // La requête d'existence est bornée à l'organisation de la clé.
    expect(analyseCount.mock.calls[0][0].where).toMatchObject({ id: 'other', organizationId: 'orgA' })
    expect(proposalCreate).not.toHaveBeenCalled()
    expect(risqueCreate).not.toHaveBeenCalled()
  })

  it('proposition valide → crée une McpProposal EN_ATTENTE (pas de risque réel)', async () => {
    analyseCount.mockResolvedValue(1)
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
    analyseCount.mockResolvedValue(1)
    const res = await proposeRiskTool.handler({ analyseId: 'an1', risque: { nom: '   ' } }, ctx)
    expect(res.isError).toBe(true)
    expect(proposalCreate).not.toHaveBeenCalled()
  })
})

describe('propose_measure', () => {
  it('valide → crée une McpProposal type "measure" EN_ATTENTE (pas de mesure réelle)', async () => {
    analyseCount.mockResolvedValue(1)
    proposalCreate.mockResolvedValue({ id: 'prop2', statut: 'EN_ATTENTE' })
    const res = await proposeMeasureTool.handler({ analyseId: 'an1', mesure: { nom: 'MFA', type: 'BOGUS', priorite: 1 } }, ctx)
    expect(res.isError).toBeUndefined()
    const data = proposalCreate.mock.calls[0][0].data
    expect(data).toMatchObject({ organizationId: 'orgA', apiKeyId: 'key1', type: 'measure', targetType: 'ANALYSE', targetId: 'an1', statut: 'EN_ATTENTE' })
    expect(data.payload).toMatchObject({ nom: 'MFA', type: 'PREVENTIVE', priorite: 1 }) // type inconnu normalisé
  })

  it('analyse hors organisation → isError, aucune écriture', async () => {
    analyseCount.mockResolvedValue(0)
    const res = await proposeMeasureTool.handler({ analyseId: 'other', mesure: { nom: 'X' } }, ctx)
    expect(res.isError).toBe(true)
    expect(proposalCreate).not.toHaveBeenCalled()
  })
})

describe('propose_plan_action', () => {
  it('ancré à un RISQUE existant → crée une McpProposal type "plan_action"', async () => {
    riskItemCount.mockResolvedValue(1)
    proposalCreate.mockResolvedValue({ id: 'prop3', statut: 'EN_ATTENTE' })
    const res = await proposePlanActionTool.handler(
      { targetType: 'RISQUE', targetId: 'ri1', planAction: { titre: 'Durcir le VPN', priorite: 'CRITIQUE' } }, ctx)
    expect(res.isError).toBeUndefined()
    // Existence bornée à l'org.
    expect(riskItemCount.mock.calls[0][0].where).toMatchObject({ id: 'ri1', organizationId: 'orgA' })
    const data = proposalCreate.mock.calls[0][0].data
    expect(data).toMatchObject({ type: 'plan_action', targetType: 'RISQUE', targetId: 'ri1', statut: 'EN_ATTENTE' })
    expect(data.payload).toMatchObject({ titre: 'Durcir le VPN', priorite: 'CRITIQUE' })
  })

  it('type d\'ancre invalide → isError, aucune écriture', async () => {
    const res = await proposePlanActionTool.handler(
      { targetType: 'PLANETE', targetId: 'x', planAction: { titre: 'T' } }, ctx)
    expect(res.isError).toBe(true)
    expect(proposalCreate).not.toHaveBeenCalled()
  })

  it('ancre inexistante dans l\'org → isError', async () => {
    riskItemCount.mockResolvedValue(0)
    const res = await proposePlanActionTool.handler(
      { targetType: 'RISQUE', targetId: 'nope', planAction: { titre: 'T' } }, ctx)
    expect(res.isError).toBe(true)
    expect(proposalCreate).not.toHaveBeenCalled()
  })

  it('sans titre → isError', async () => {
    riskItemCount.mockResolvedValue(1)
    const res = await proposePlanActionTool.handler(
      { targetType: 'RISQUE', targetId: 'ri1', planAction: { titre: '  ' } }, ctx)
    expect(res.isError).toBe(true)
    expect(proposalCreate).not.toHaveBeenCalled()
  })
})

describe('propose_conformite', () => {
  it('ancré à un référentiel de conformité existant → McpProposal type "conformite"', async () => {
    conformiteCount.mockResolvedValue(1)
    proposalCreate.mockResolvedValue({ id: 'prop4', statut: 'EN_ATTENTE' })
    const res = await proposeConformiteTool.handler(
      { targetId: 'cf1', conformite: { ref: 'A.5.1', statut: 'non_conforme', commentaire: 'MFA absente' } }, ctx)
    expect(res.isError).toBeUndefined()
    // Existence bornée à l'org, ancre FIXE CONFORMITE.
    expect(conformiteCount.mock.calls[0][0].where).toMatchObject({ id: 'cf1', organizationId: 'orgA' })
    const data = proposalCreate.mock.calls[0][0].data
    expect(data).toMatchObject({ type: 'conformite', targetType: 'CONFORMITE', targetId: 'cf1', statut: 'EN_ATTENTE' })
    expect(data.payload).toMatchObject({ ref: 'A.5.1', statut: 'non_conforme', commentaire: 'MFA absente' })
    expect(parse(res)).toMatchObject({ proposalId: 'prop4', statut: 'EN_ATTENTE' })
  })

  it('référentiel hors organisation → isError, aucune écriture', async () => {
    conformiteCount.mockResolvedValue(0)
    const res = await proposeConformiteTool.handler({ targetId: 'nope', conformite: { ref: 'A.5.1', statut: 'conforme' } }, ctx)
    expect(res.isError).toBe(true)
    expect(proposalCreate).not.toHaveBeenCalled()
  })

  it('statut inconnu → isError (ref + statut connu requis)', async () => {
    conformiteCount.mockResolvedValue(1)
    const res = await proposeConformiteTool.handler({ targetId: 'cf1', conformite: { ref: 'A.5.1', statut: 'BOF' } }, ctx)
    expect(res.isError).toBe(true)
    expect(proposalCreate).not.toHaveBeenCalled()
  })
})
