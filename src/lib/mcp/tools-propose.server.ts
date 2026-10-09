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
  sanitizePlanActionProposal, isPlanActionProposalValid, PROPOSAL_TARGET_TYPES,
  sanitizeConformiteProposal, isConformiteProposalValid,
} from './proposals'
import { CONFORMITE_STATUTS } from '@/lib/conformite'
import { anchorExistsInOrg } from './anchors.server'
import { parseAnalysisImportRequest, summarizeAnalysisImport } from '@/lib/analysis-import'
import { getEffectiveScaleConfig } from '@/lib/configuration-server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isProjet360ProposalValid, sanitizeProjet360Proposal } from './projet360-proposal'
import { hasAtelierContent, summarizeAtelierContent } from '@/lib/analysis-import-ateliers'
import { isPssiProposalValid, sanitizePssiProposal } from './pssi-proposal'

/** Origines possibles d'un plan d'action : un objet précis, jamais l'organisation entière. */
const PLAN_TARGET_TYPES = PROPOSAL_TARGET_TYPES.filter(t => t !== 'ORGANISATION')

/** Vérifie qu'une analyse (ancre ANALYSE) appartient à l'organisation de la clé. */
async function analyseInOrg(analyseId: string, organizationId: string): Promise<boolean> {
  return anchorExistsInOrg('ANALYSE', analyseId, organizationId)
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
    "Propose un risque pour une analyse ou un projet 360 de l'organisation. Ne crée RIEN : proposition validée par un humain " +
    "dans l'interface. Fournir `analyseId` (voir read_analyses) et `risque` { nom, description?, domaine? (projet 360 : CYBER, IT, " +
    "PROJECT, BUSINESS, FRAUD, OUTSOURCING), gravite et vraisemblance (brut), graviteActuelle / vraisemblanceActuelle (avec les " +
    "mesures existantes), graviteResiduelle / vraisemblanceResiduelle (après traitement), strategie, mesures? [{ nom, type }], " +
    "plans? [{ titre, porteur?, echeance AAAA-MM-JJ?, priorite }] }. Cotations sur l'échelle de l'organisation (voir read_projet) ; " +
    "actuel ≤ brut et résiduel ≤ actuel sont imposés. Mesures et plans sont créés avec le risque à l'acceptation.",
  inputSchema: {
    type: 'object',
    properties: {
      analyseId: { type: 'string', description: "Identifiant de l'analyse ou du projet cible (dans l'organisation de la clé)." },
      risque: {
        type: 'object',
        description: 'Proposition de risque.',
        properties: {
          nom: { type: 'string' },
          description: { type: 'string' },
          domaine: { type: 'string', enum: ['CYBER', 'IT', 'PROJECT', 'BUSINESS', 'FRAUD', 'OUTSOURCING'] },
          gravite: { type: 'integer', minimum: 1, maximum: 5 },
          vraisemblance: { type: 'integer', minimum: 1, maximum: 5 },
          graviteActuelle: { type: 'integer', minimum: 1, maximum: 5 },
          vraisemblanceActuelle: { type: 'integer', minimum: 1, maximum: 5 },
          graviteResiduelle: { type: 'integer', minimum: 1, maximum: 5 },
          vraisemblanceResiduelle: { type: 'integer', minimum: 1, maximum: 5 },
          strategie: { type: 'string', enum: ['REDUIRE', 'ACCEPTER', 'TRANSFERER', 'REFUSER', 'SURVEILLER'] },
          mesures: { type: 'array', maxItems: 10, items: { type: 'object', properties: { nom: { type: 'string' }, type: { type: 'string', enum: [...MEASURE_TYPES] } }, required: ['nom'] } },
          plans: { type: 'array', maxItems: 10, items: { type: 'object', properties: { titre: { type: 'string' }, porteur: { type: 'string' }, echeance: { type: 'string', description: 'AAAA-MM-JJ' }, priorite: { type: 'string', enum: ['CRITIQUE', 'MAJEUR', 'MODERE'] } }, required: ['titre'] } },
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
    // Échelle de l'organisation (4 ou 5 niveaux) : la proposition est bornée comme une saisie directe.
    const { nbNiveaux } = await getEffectiveScaleConfig(ctx.organizationId)
    const payload = sanitizeRiskProposal(args.risque, nbNiveaux)
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
 * `propose_plan_action` — dépose une proposition de plan d'action rattaché à une
 * ORIGINE concrète (`targetType` ∈ ANALYSE|RISQUE|CONFORMITE|CONTROLE|AUDIT|
 * INCIDENT, `targetId`). Ne crée AUCUN plan d'action : à l'acceptation, un
 * `PlanAction` + son lien polymorphe sont créés sous le RBAC de gouvernance.
 */
export const proposePlanActionTool: McpTool<McpContext> = {
  name: 'propose_plan_action',
  description:
    "Propose un plan d'action rattaché à une origine (risque du registre, exigence de conformité, " +
    "anomalie de contrôle, constat d'audit, incident, ou analyse). Ne crée PAS le plan : dépose une " +
    "proposition validée par un humain. Fournir `targetType`, `targetId` (l'origine, dans l'organisation) " +
    "et `planAction` { titre, description?, porteur?, entite?, echeance?, priorite?, statut? }.",
  inputSchema: {
    type: 'object',
    properties: {
      targetType: { type: 'string', enum: [...PLAN_TARGET_TYPES], description: "Type de l'origine (ancre)." },
      targetId: { type: 'string', description: "Identifiant de l'origine (dans l'organisation de la clé)." },
      planAction: {
        type: 'object',
        description: "Proposition de plan d'action.",
        properties: {
          titre: { type: 'string' },
          description: { type: 'string' },
          porteur: { type: 'string' },
          entite: { type: 'string' },
          echeance: { type: 'string', description: 'Date ISO 8601.' },
          priorite: { type: 'string', enum: ['CRITIQUE', 'MAJEUR', 'MODERE'] },
          statut: { type: 'string', enum: ['A_FAIRE', 'EN_COURS', 'FAIT'] },
        },
        required: ['titre'],
        additionalProperties: false,
      },
    },
    required: ['targetType', 'targetId', 'planAction'],
    additionalProperties: false,
  },
  async handler(args, ctx): Promise<McpToolResult> {
    const targetType = typeof args.targetType === 'string' ? args.targetType : ''
    const targetId = typeof args.targetId === 'string' ? args.targetId : ''
    if (!(PLAN_TARGET_TYPES as readonly string[]).includes(targetType)) {
      return { content: [{ type: 'text', text: 'ancre_invalide' }], isError: true }
    }
    // Ancre bornée à l'organisation : une origine hors périmètre est « introuvable ».
    if (!(await anchorExistsInOrg(targetType, targetId, ctx.organizationId))) {
      return { content: [{ type: 'text', text: 'ancre_introuvable' }], isError: true }
    }
    const payload = sanitizePlanActionProposal(args.planAction)
    if (!isPlanActionProposalValid(payload)) {
      return { content: [{ type: 'text', text: 'proposition_invalide: titre requis' }], isError: true }
    }
    return depose('plan_action', targetType, targetId, payload, ctx)
  },
}

/**
 * `propose_conformite` — dépose une proposition de STATUT de conformité pour un
 * contrôle (`ref`) d'un référentiel de conformité (ancre CONFORMITE = un
 * enregistrement `Conformite` de l'organisation). Ne modifie RIEN : à l'acceptation,
 * le statut (+ commentaire) est appliqué aux entrées du référentiel, sous RBAC.
 */
export const proposeConformiteTool: McpTool<McpContext> = {
  name: 'propose_conformite',
  description:
    "Propose un nouveau statut de conformité pour un contrôle d'un référentiel (ISO 27001, DORA, PCI-DSS…). " +
    "Ne modifie PAS la conformité : dépose une proposition validée par un humain habilité. Fournir `targetId` " +
    "(l'identifiant du référentiel de conformité, dans l'organisation de la clé) et `conformite` " +
    "{ ref (référence du contrôle), statut (conforme|partiel|non_conforme|na), commentaire? }.",
  inputSchema: {
    type: 'object',
    properties: {
      targetId: { type: 'string', description: "Identifiant du référentiel de conformité (Conformite) dans l'organisation." },
      conformite: {
        type: 'object',
        description: 'Proposition de statut de conformité pour un contrôle.',
        properties: {
          ref: { type: 'string', description: 'Référence du contrôle (ex. « A.5.1 »).' },
          statut: { type: 'string', enum: [...CONFORMITE_STATUTS], description: 'Statut proposé.' },
          commentaire: { type: 'string', description: 'Justification (optionnelle).' },
        },
        required: ['ref', 'statut'],
        additionalProperties: false,
      },
    },
    required: ['targetId', 'conformite'],
    additionalProperties: false,
  },
  async handler(args, ctx): Promise<McpToolResult> {
    const targetId = typeof args.targetId === 'string' ? args.targetId : ''
    // Ancre FIXE CONFORMITE bornée à l'organisation : un référentiel hors périmètre est « introuvable ».
    if (!(await anchorExistsInOrg('CONFORMITE', targetId, ctx.organizationId))) {
      return { content: [{ type: 'text', text: 'ancre_introuvable' }], isError: true }
    }
    const payload = sanitizeConformiteProposal(args.conformite)
    if (!isConformiteProposalValid(payload)) {
      return { content: [{ type: 'text', text: 'proposition_invalide: ref + statut connu requis' }], isError: true }
    }
    return depose('conformite', 'CONFORMITE', targetId, payload, ctx)
  },
}

/** Dépose un lot historique complet, qui reste obligatoirement revu avant écriture. */
export const proposeAnalysisImportTool: McpTool<McpContext> = {
  name: 'propose_analysis_import',
  description: "Propose l'import de risques, mesures et plans d'action dans une analyse existante. Ne crée rien directement : un utilisateur habilité doit accepter la proposition. Le contenu des ateliers (valeurs métier, biens supports, scénarios…) est refusé ici : il ne s'importe que dans une nouvelle analyse (propose_nouvelle_analyse).",
  inputSchema: {
    type: 'object', properties: {
      analyseId: { type: 'string' },
      import: { type: 'object', description: 'Paquet canonique : analysis { title }, risks[], measures[], actions[], links[].', properties: { analysis: { type: 'object' }, risks: { type: 'array' }, measures: { type: 'array' }, actions: { type: 'array' }, links: { type: 'array' } }, required: ['analysis'], additionalProperties: false },
    }, required: ['analyseId', 'import'], additionalProperties: false,
  },
  async handler(args, ctx): Promise<McpToolResult> {
    const analyseId = typeof args.analyseId === 'string' ? args.analyseId : ''
    if (!(await analyseInOrg(analyseId, ctx.organizationId))) return { content: [{ type: 'text', text: 'analyse_introuvable' }], isError: true }
    try {
      const payload = parseAnalysisImportRequest({ ...(args.import as object), idempotencyKey: `mcp-${Date.now()}-${Math.random().toString(36).slice(2)}` })
      // Contenu des ateliers (paquet v3) : il n'est écrit qu'à la création d'une analyse ; dans une analyse existante il
      // serait perdu à l'acceptation — refus explicite plutôt qu'une perte silencieuse (B-IMP-73).
      if (hasAtelierContent(payload)) return { content: [{ type: 'text', text: 'contenu_ateliers_non_pris_en_charge: le contenu des ateliers (valeurs métier, biens supports, scénarios…) ne s’importe que dans une NOUVELLE analyse — utiliser propose_nouvelle_analyse, ou retirer ces collections pour compléter une analyse existante (risques, mesures, plans d’action, liens).' }], isError: true }
      return depose('analysis_import', 'ANALYSE', analyseId, payload, ctx)
    } catch { return { content: [{ type: 'text', text: 'proposition_invalide: paquet historique invalide' }], isError: true } }
  },
}

/** Aperçu MCP sans écriture : l'agent peut détecter les liens orphelins avant proposition. */
export const previewAnalysisImportTool: McpTool<McpContext> = {
  name: 'analyse_import_preview',
  description: "Valide et résume un paquet d'import historique sans écrire de donnée (paquet canonique v3 : risques, mesures, plans, liens et, en EBIOS RM, contenu des ateliers 1 à 4). Renvoie les volumes, les références introuvables et les avertissements (dont les niveaux de risque divergents du calcul ACRA).",
  inputSchema: { type: 'object', properties: { import: { type: 'object', properties: { analysis: { type: 'object' }, risks: { type: 'array' }, vulnerabilities: { type: 'array' }, measures: { type: 'array' }, actions: { type: 'array' }, links: { type: 'array' }, context: { type: 'object' }, businessValues: { type: 'array' }, supportAssets: { type: 'array' }, fearedEvents: { type: 'array' }, riskSources: { type: 'array' }, stakeholders: { type: 'array' }, strategicScenarios: { type: 'array' }, operationalScenarios: { type: 'array' }, securityBaseline: { type: 'array' }, residualRisks: { type: 'array' } }, required: ['analysis'], additionalProperties: false } }, required: ['import'], additionalProperties: false },
  async handler(args, ctx): Promise<McpToolResult> {
    try {
      const parsed = parseAnalysisImportRequest({ ...(args.import as object), idempotencyKey: 'mcp-preview-0001' })
      // Paquet v3 : volumes et références orphelines des ateliers 1 à 4, comme l'aperçu de l'API v2.
      return toolText({ valid: true, ...summarizeAnalysisImport(parsed, await getEffectiveScaleConfig(ctx.organizationId)), ...(hasAtelierContent(parsed) ? { ateliers: summarizeAtelierContent(parsed, parsed.risks.flatMap(r => (r.externalId ? [r.externalId] : []))) } : {}) })
    }
    catch { return { content: [{ type: 'text', text: 'import_invalide' }], isError: true } }
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

/**
 * `propose_projet360` — propose la création d'un projet 360 (les champs du formulaire de lancement). Ancre :
 * l'organisation de la clé. Ne crée RIEN : un humain habilité à créer des analyses accepte, et le projet est alors
 * créé et peuplé comme depuis l'interface (questionnaire pré-rempli, risques et plans par défaut).
 */
export const proposeProjet360Tool: McpTool<McpContext> = {
  name: 'propose_projet360',
  description:
    "Propose la création d'un projet 360 (risque opérationnel complet d'un projet, ISO 31000:2018). Ne crée RIEN : un humain " +
    "valide dans l'interface. Fournir `projet` { nom, description? (périmètre), objectifs?, secteur (libellé de read_sector_examples), " +
    "sousSecteurs? (identifiants), patternsArchi (au moins un code de pattern d'architecture), miseEnService? AAAA-MM-JJ }. " +
    "Une fois le projet accepté, retrouvez-le avec read_analyses puis proposez ses risques (propose_risk).",
  inputSchema: {
    type: 'object',
    properties: {
      projet: {
        type: 'object',
        properties: {
          nom: { type: 'string' }, description: { type: 'string' }, objectifs: { type: 'string' }, secteur: { type: 'string' },
          sousSecteurs: { type: 'array', items: { type: 'string' } }, patternsArchi: { type: 'array', items: { type: 'string' } },
          miseEnService: { type: 'string', description: 'AAAA-MM-JJ' },
        },
        required: ['nom', 'secteur', 'patternsArchi'],
        additionalProperties: false,
      },
    },
    required: ['projet'],
    additionalProperties: false,
  },
  async handler(args, ctx): Promise<McpToolResult> {
    const cfg = await getOrgConfig(ctx.organizationId)
    if (!cfg.projets360Active) return { content: [{ type: 'text', text: 'module_projets360_inactif' }], isError: true }
    const payload = sanitizeProjet360Proposal(args.projet, { patternsMax: cfg.patternsArchiMax })
    if (!isProjet360ProposalValid(payload)) {
      return { content: [{ type: 'text', text: 'proposition_invalide: nom, secteur et au moins un pattern d’architecture requis' }], isError: true }
    }
    return depose('projet360', 'ORGANISATION', ctx.organizationId, payload, ctx)
  },
}

/** Origine d'une nouvelle analyse proposée : rédigée d'après une expression de besoins, ou reprise d'une analyse existante. */
export const ORIGINES_NOUVELLE_ANALYSE = ['EXPRESSION_BESOINS', 'ANALYSE_HISTORIQUE'] as const

/**
 * `propose_nouvelle_analyse` — propose la CRÉATION d'une analyse de risque complète (paquet canonique de l'import
 * historique : contexte, risques, mesures, plans, contenu des ateliers EBIOS RM). Ancre : l'organisation de la clé.
 * Rien n'est créé avant qu'un humain habilité à créer des analyses accepte ; la création passe alors par
 * l'import historique (même transaction, mêmes garde-fous, source MCP).
 */
export const proposeNouvelleAnalyseTool: McpTool<McpContext> = {
  name: 'propose_nouvelle_analyse',
  description:
    "Propose la création d'une nouvelle analyse de risque, rédigée d'après une expression de besoins (origine EXPRESSION_BESOINS) " +
    "ou reprise d'une analyse existante hors outil (origine ANALYSE_HISTORIQUE). Ne crée RIEN : un humain valide dans l'interface. " +
    "Fournir `import` : analysis { title, description?, methode? (EBIOS_RM|ISO_27005|ISO_31000|NIST_800_30), secteur?, sousSecteurs?, patternsArchi? }, " +
    "context? { perimetre, objectifs… }, risks[] { externalId, title, description?, gravity 1-4, likelihood 1-4, strategy? }, measures[], actions[], " +
    "links[] { riskExternalId, actionExternalId } et, en EBIOS RM, le contenu des ateliers (businessValues, supportAssets, fearedEvents, " +
    "riskSources, strategicScenarios, operationalScenarios…). Vérifier d'abord le paquet avec analyse_import_preview.",
  inputSchema: {
    type: 'object',
    properties: {
      origine: { type: 'string', enum: [...ORIGINES_NOUVELLE_ANALYSE], description: 'EXPRESSION_BESOINS (défaut) ou ANALYSE_HISTORIQUE.' },
      import: { type: 'object', description: 'Paquet canonique (cf. analyse_import_preview).', properties: { analysis: { type: 'object' } }, required: ['analysis'] },
    },
    required: ['import'],
    additionalProperties: false,
  },
  async handler(args, ctx): Promise<McpToolResult> {
    const origine = ORIGINES_NOUVELLE_ANALYSE.find(o => o === args.origine) ?? 'EXPRESSION_BESOINS'
    let paquet
    try {
      // Le paquet est revalidé (Zod) : toute clé inconnue, dont un identifiant d'organisation, est écartée.
      paquet = parseAnalysisImportRequest({ ...(args.import as object), idempotencyKey: `mcp-new-${Date.now()}-${Math.random().toString(36).slice(2)}` })
    } catch { return { content: [{ type: 'text', text: 'proposition_invalide: paquet d’analyse invalide (cf. analyse_import_preview)' }], isError: true } }
    return depose('analysis_create', 'ORGANISATION', ctx.organizationId, { origine, ...paquet }, ctx)
  },
}

/**
 * `propose_pssi` — propose l'import d'une PSSI : référentiel personnalisé de type PSSI (exigences = mesures, utilisable
 * comme référentiel de conformité), document de la bibliothèque rattaché et suivi de conformité. Ancre : l'organisation.
 * Accepté par un administrateur (même règle que la création d'un référentiel), module conformité actif.
 */
export const proposePssiTool: McpTool<McpContext> = {
  name: 'propose_pssi',
  description:
    "Propose l'import d'une PSSI (politique de sécurité des systèmes d'information) : elle devient un référentiel de mesures de type PSSI, " +
    "suivi en conformité, et un document de la bibliothèque. Ne crée RIEN : un administrateur valide dans l'interface. Fournir `pssi` " +
    "{ titre, version, code? (défaut PSSI-<version>), date? AAAA-MM-JJ, description?, texte? (Markdown intégral), " +
    "exigences[] { ref, nom, description?, categorie?, type? (ORGANISATIONNELLE|TECHNIQUE|PHYSIQUE|JURIDIQUE) }, suivreConformite? (défaut true) }.",
  inputSchema: {
    type: 'object',
    properties: {
      pssi: {
        type: 'object',
        properties: {
          titre: { type: 'string' }, version: { type: 'string' }, code: { type: 'string' }, date: { type: 'string', description: 'AAAA-MM-JJ' },
          description: { type: 'string' }, texte: { type: 'string' }, domaine: { type: 'string' }, suivreConformite: { type: 'boolean' },
          exigences: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string' }, nom: { type: 'string' }, description: { type: 'string' }, categorie: { type: 'string' }, type: { type: 'string' } }, required: ['ref', 'nom'] } },
        },
        required: ['titre', 'exigences'],
        additionalProperties: false,
      },
    },
    required: ['pssi'],
    additionalProperties: false,
  },
  async handler(args, ctx): Promise<McpToolResult> {
    const cfg = await getOrgConfig(ctx.organizationId)
    if (!cfg.conformiteActive) return { content: [{ type: 'text', text: 'module_conformite_inactif' }], isError: true }
    const payload = sanitizePssiProposal(args.pssi)
    if (!isPssiProposalValid(payload)) {
      return { content: [{ type: 'text', text: 'proposition_invalide: titre et au moins une exigence (ref + nom) requis' }], isError: true }
    }
    const pris = await prisma.referentiel.count({ where: { organizationId: ctx.organizationId, code: payload.referentiel.code } })
    if (pris) return { content: [{ type: 'text', text: `code_existant: ${payload.referentiel.code} (fournir un autre code ou une autre version)` }], isError: true }
    return depose('pssi', 'ORGANISATION', ctx.organizationId, payload, ctx)
  },
}

/** Outils d'écriture validée : propositions déposées, jamais appliquées directement. */
export function buildProposeTools(): McpTool<McpContext>[] {
  return [proposeProjet360Tool, proposeRiskTool, proposeMeasureTool, proposePlanActionTool, proposeConformiteTool, previewAnalysisImportTool, proposeAnalysisImportTool, proposeNouvelleAnalyseTool, proposePssiTool]
}
