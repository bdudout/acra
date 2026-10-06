// ─── Outils MCP — implémentations serveur (org-scopées) ──────────────────────
// Handlers des outils MCP. Chaque outil est STRICTEMENT borné à l'organisation de
// la clé d'API (`ctx.organizationId`) — mêmes gardes que l'API v1 / les routes
// org-scopées (cf. docs/ARCHITECTURE.md §5, tests IDOR). Convention : `read_*`
// (lecture, contexte) ; les `propose_*` (écritures validées) viendront en phases
// ultérieures (cf. docs/mcp-cadrage.md §10).

import { prisma } from '@/lib/prisma'
import { toolText, type McpTool, type McpToolResult } from './protocol'
import { buildContextTools } from './tools-context.server'
import { buildProposeTools } from './tools-propose.server'
import { recommendRisksScenariosTool, recommendControlPlanTool } from './tools-recommend.server'
import { buildKnowledgeTools } from './tools-knowledge.server'

/** Contexte serveur injecté aux outils : périmètre organisationnel + clé d'API émettrice. */
export interface McpContext { organizationId: string; keyId: string }

const MAX_REFERENTIELS = 200 // borne de lecture (anti-volume, cf. cadrage §11)

/** Entier borné à [min, max] à partir d'une entrée arbitraire (défaut si invalide). */
function clampLimit(v: unknown, def: number, max: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(1, Math.floor(n)))
}

/**
 * `read_referentiels` — liste les référentiels de l'organisation (résumé) ; si un
 * `code` est fourni, renvoie aussi les exigences de CE référentiel. Lecture seule,
 * bornée à l'organisation de la clé. Ne divulgue jamais l'existence d'un
 * référentiel d'une autre organisation (filtre `organizationId`).
 */
export const readReferentielsTool: McpTool<McpContext> = {
  name: 'read_referentiels',
  description:
    "Liste les référentiels (PSSI, politiques, cadres réglementaires/standards) de l'organisation. " +
    "Fournir un `code` pour obtenir en plus les exigences détaillées de ce référentiel. Lecture seule, org-scopée.",
  inputSchema: {
    type: 'object',
    properties: {
      code: { type: 'string', description: "Code d'un référentiel (ex. PSSI-2026) pour détailler ses exigences." },
      limit: { type: 'integer', minimum: 1, maximum: MAX_REFERENTIELS, description: 'Nombre maximum de référentiels listés.' },
    },
    additionalProperties: false,
  },
  async handler(args, ctx): Promise<McpToolResult> {
    const code = typeof args.code === 'string' && args.code.trim() ? args.code.trim() : null
    const take = clampLimit(args.limit, 50, MAX_REFERENTIELS)

    if (code) {
      const ref = await prisma.referentiel.findFirst({
        where: { organizationId: ctx.organizationId, code },
        select: {
          id: true, code: true, nom: true, type: true, domaine: true, version: true,
          description: true, actif: true, exigences: true, updatedAt: true,
        },
      })
      // Absence traitée comme une liste vide (pas d'erreur, pas de divulgation).
      if (!ref) return toolText({ referentiel: null, found: false })
      const exigences = Array.isArray(ref.exigences) ? ref.exigences : []
      return toolText({ found: true, referentiel: { ...ref, exigences, nbExigences: exigences.length } })
    }

    const rows = await prisma.referentiel.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: [{ actif: 'desc' }, { code: 'asc' }],
      take,
      select: { code: true, nom: true, type: true, domaine: true, version: true, actif: true, exigences: true, updatedAt: true },
    })
    const data = rows.map(r => {
      const { exigences, ...rest } = r
      return { ...rest, nbExigences: Array.isArray(exigences) ? exigences.length : 0 }
    })
    return toolText({ count: data.length, referentiels: data })
  },
}

/**
 * Registre des outils MCP exposés. Phase 1 : `read_referentiels`. Phase 2
 * (contexte) : `read_taxonomie`, `read_sector_examples`, `read_risk_posture`
 * (cf. `tools-context.server.ts`).
 */
export function buildMcpTools(): McpTool<McpContext>[] {
  return [readReferentielsTool, ...buildContextTools(), recommendRisksScenariosTool, recommendControlPlanTool, ...buildKnowledgeTools(), ...buildProposeTools()].map(annoter)
}

/** Titres lisibles affichés par les clients MCP (Claude, Codex, Mistral Vibe…). */
const TITRES: Record<string, string> = {
  read_referentiels: 'Référentiels et exigences', read_taxonomie: 'Taxonomie des risques', read_sector_examples: 'Exemples par secteur et architecture',
  read_risk_posture: 'Posture de risque', recommend_risks_scenarios: 'Risques et scénarios recommandés', recommend_control_plan: 'Plan de contrôle recommandé',
  read_notification_regimes: 'Régimes de déclaration', read_incident_types: 'Incidents types', read_dora_fields: 'Champs de déclaration DORA',
  read_catalogue: 'Catalogue sectoriel', read_resilience_tests: 'Tests de résilience', propose_risk: 'Proposer un risque', propose_measure: 'Proposer une mesure',
  propose_plan_action: 'Proposer un plan d’action', propose_conformite: 'Proposer une évaluation de conformité',
  analyse_import_preview: 'Aperçu d’import d’analyse', propose_analysis_import: 'Proposer l’import d’une analyse',
}

/**
 * Annotations MCP : lectures, recommandations (calculées par ACRA) et aperçus en lecture seule ; propositions non
 * destructives (elles créent une proposition en attente de validation humaine, jamais d'écriture directe). Aucun outil
 * n'accède au monde extérieur.
 */
function annoter(t: McpTool<McpContext>): McpTool<McpContext> {
  const lecture = /^(read_|recommend_)|_preview$/.test(t.name)
  return {
    ...t, title: t.title ?? TITRES[t.name] ?? t.name,
    annotations: { ...(lecture ? { readOnlyHint: true } : { readOnlyHint: false, destructiveHint: false, idempotentHint: false }), openWorldHint: false, ...t.annotations },
  }
}
