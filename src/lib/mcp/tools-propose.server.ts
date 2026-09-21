// ─── Outils MCP d'ÉCRITURE VALIDÉE (phase 3, cf. docs/mcp-cadrage.md §6/§10.3) ─
// Les outils `propose_*` NE créent PAS l'objet final : ils déposent une
// PROPOSITION (brouillon assaini) dans la file de validation, revue par un humain
// habilité en UI. STRICTEMENT org-scopés ; le contenu fourni par l'agent est de la
// DONNÉE (assainie), jamais des instructions.

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { toolText, type McpTool, type McpToolResult } from './protocol'
import type { McpContext } from './tools.server'
import {
  sanitizeRiskProposal, isRiskProposalValid,
  sanitizeMeasureProposal, isMeasureProposalValid, MEASURE_TYPES, MEASURE_STATUS,
} from './proposals'

/** Vérifie qu'une analyse appartient à l'organisation de la clé (sans divulgation). */
async function analyseInOrg(analyseId: string, organizationId: string): Promise<boolean> {
  if (!analyseId) return false
  const a = await prisma.analyse.findFirst({
    where: { id: analyseId, organizationId, deletedAt: null },
    select: { id: true },
  })
  return !!a
}

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
    if (!(await analyseInOrg(analyseId, ctx.organizationId))) {
      return { content: [{ type: 'text', text: 'analyse_introuvable' }], isError: true }
    }
    const payload = sanitizeRiskProposal(args.risque)
    if (!isRiskProposalValid(payload)) {
      return { content: [{ type: 'text', text: 'proposition_invalide: nom requis' }], isError: true }
    }
    return depose('risk', 'ANALYSE', analyseId, payload, ctx)
  },
}

/**
 * `propose_measure` — dépose une proposition de mesure de traitement pour une
 * analyse de l'organisation. Ne crée AUCUNE mesure : validation humaine en UI.
 */
export const proposeMeasureTool: McpTool<McpContext> = {
  name: 'propose_measure',
  description:
    "Propose l'ajout d'une mesure de traitement à une analyse (atelier 5). Ne crée PAS la mesure : " +
    "dépose une proposition validée par un humain. Fournir `analyseId` et `mesure` " +
    "{ nom, type, priorite 1-4, statut, description?, responsable?, entite?, echeance?, cout?, efficacite? 1-4 }.",
  inputSchema: {
    type: 'object',
    properties: {
      analyseId: { type: 'string', description: "Identifiant de l'analyse cible (dans l'organisation de la clé)." },
      mesure: {
        type: 'object',
        description: 'Proposition de mesure.',
        properties: {
          nom: { type: 'string' },
          type: { type: 'string', enum: [...MEASURE_TYPES] },
          priorite: { type: 'integer', minimum: 1, maximum: 4 },
          statut: { type: 'string', enum: [...MEASURE_STATUS] },
          description: { type: 'string' },
          responsable: { type: 'string' },
          entite: { type: 'string' },
          echeance: { type: 'string', description: 'Date ISO 8601.' },
          cout: { type: 'string' },
          efficacite: { type: 'integer', minimum: 1, maximum: 4 },
        },
        required: ['nom'],
        additionalProperties: false,
      },
    },
    required: ['analyseId', 'mesure'],
    additionalProperties: false,
  },
  async handler(args, ctx): Promise<McpToolResult> {
    const analyseId = typeof args.analyseId === 'string' ? args.analyseId : ''
    if (!(await analyseInOrg(analyseId, ctx.organizationId))) {
      return { content: [{ type: 'text', text: 'analyse_introuvable' }], isError: true }
    }
    const payload = sanitizeMeasureProposal(args.mesure)
    if (!isMeasureProposalValid(payload)) {
      return { content: [{ type: 'text', text: 'proposition_invalide: nom requis' }], isError: true }
    }
    return depose('measure', 'ANALYSE', analyseId, payload, ctx)
  },
}

/**
 * Crée une proposition EN_ATTENTE ancrée à un objet concret (`targetType` +
 * `targetId`) et renvoie un résultat MCP standard. Une proposition référence
 * toujours une ancre existante — jamais « rien ».
 */
async function depose(type: string, targetType: string, targetId: string, payload: unknown, ctx: McpContext): Promise<McpToolResult> {
  const created = await prisma.mcpProposal.create({
    data: {
      organizationId: ctx.organizationId,
      apiKeyId: ctx.keyId,
      type,
      targetType,
      targetId,
      payload: payload as Prisma.InputJsonValue,
      statut: 'EN_ATTENTE',
    },
    select: { id: true, statut: true },
  })
  return toolText({
    proposalId: created.id,
    statut: created.statut,
    message: 'Proposition déposée. Elle doit être validée par un utilisateur habilité dans l\'interface.',
  })
}

/** Outils d'écriture validée : propositions déposées, jamais appliquées directement. */
export function buildProposeTools(): McpTool<McpContext>[] {
  return [proposeRiskTool, proposeMeasureTool]
}
