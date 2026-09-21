// ─── Outils MCP d'ÉCRITURE VALIDÉE (phase 3, cf. docs/mcp-cadrage.md §6/§10.3) ─
// Les outils `propose_*` NE créent PAS l'objet final : ils déposent une
// PROPOSITION (brouillon assaini) dans la file de validation, revue par un humain
// habilité en UI. STRICTEMENT org-scopés ; le contenu fourni par l'agent est de la
// DONNÉE (assainie), jamais des instructions.

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { toolText, type McpTool, type McpToolResult } from './protocol'
import type { McpContext } from './tools.server'
import { sanitizeRiskProposal, isRiskProposalValid } from './proposals'

/**
 * `propose_risk` — dépose une proposition de risque pour une analyse de
 * l'organisation. Vérifie que l'analyse appartient à l'org de la clé (sans
 * divulgation), assainit le payload, et crée une `McpProposal` EN_ATTENTE. Ne crée
 * AUCUN risque réel : l'objet n'est créé qu'à l'acceptation humaine en UI.
 */
export const proposeRiskTool: McpTool<McpContext> = {
  name: 'propose_risk',
  description:
    "Propose l'ajout d'un risque à une analyse (atelier 5). Ne crée PAS le risque : dépose une " +
    "proposition validée par un humain dans l'interface. Fournir `analyseId` (de l'organisation) et " +
    "`risque` { nom, gravite 1-4, vraisemblance 1-4, strategie, description?, niveauResiduel? 1-16 }.",
  inputSchema: {
    type: 'object',
    properties: {
      analyseId: { type: 'string', description: "Identifiant de l'analyse cible (dans l'organisation de la clé)." },
      risque: {
        type: 'object',
        description: 'Proposition de risque.',
        properties: {
          nom: { type: 'string' },
          gravite: { type: 'integer', minimum: 1, maximum: 4 },
          vraisemblance: { type: 'integer', minimum: 1, maximum: 4 },
          strategie: { type: 'string', enum: ['REDUIRE', 'ACCEPTER', 'TRANSFERER', 'REFUSER', 'SURVEILLER'] },
          description: { type: 'string' },
          niveauResiduel: { type: 'integer', minimum: 1, maximum: 16 },
        },
        required: ['nom'],
        additionalProperties: false,
      },
    },
    required: ['analyseId', 'risque'],
    additionalProperties: false,
  },
  async handler(args, ctx): Promise<McpToolResult> {
    const analyseId = typeof args.analyseId === 'string' ? args.analyseId : ''
    // Cible bornée à l'organisation : une analyse hors périmètre est « introuvable »
    // (aucune divulgation d'existence).
    const analyse = analyseId
      ? await prisma.analyse.findFirst({
          where: { id: analyseId, organizationId: ctx.organizationId, deletedAt: null },
          select: { id: true },
        })
      : null
    if (!analyse) return { content: [{ type: 'text', text: 'analyse_introuvable' }], isError: true }

    const payload = sanitizeRiskProposal(args.risque)
    if (!isRiskProposalValid(payload)) {
      return { content: [{ type: 'text', text: 'proposition_invalide: nom requis' }], isError: true }
    }

    const created = await prisma.mcpProposal.create({
      data: {
        organizationId: ctx.organizationId,
        apiKeyId: ctx.keyId,
        type: 'risk',
        analyseId,
        payload: payload as unknown as Prisma.InputJsonValue,
        statut: 'EN_ATTENTE',
      },
      select: { id: true, statut: true },
    })

    return toolText({
      proposalId: created.id,
      statut: created.statut,
      message: 'Proposition déposée. Elle doit être validée par un utilisateur habilité dans l\'interface.',
    })
  },
}

/** Outils d'écriture validée (phase 3) : propositions déposées, jamais appliquées directement. */
export function buildProposeTools(): McpTool<McpContext>[] {
  return [proposeRiskTool]
}
