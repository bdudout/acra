// ─── Outil MCP de RECOMMANDATION (phase 5, cf. docs/specs/chantier-contenu-sectoriel-mcp-rapports.md § B.2.2) ─────────────
// `recommend_risks_scenarios` : propose à l'agent des risques et scénarios à envisager, CALCULÉS par ACRA à partir du
// catalogue sectoriel et des exemples livrés — AUCUN LLM, AUCUNE écriture. Strictement borné à l'organisation de la clé ;
// ce qui existe déjà (registre, analyse) est écarté. L'agent peut ensuite déposer une proposition ancrée (`propose_*`).

import { catalogueRisquesTypesAnalyse } from '@/lib/risques-types.server'
import { getT } from '@/lib/i18n'
import { sousSecteursOf } from '@/lib/sous-secteurs'
import { patternsOf } from '@/lib/patterns-archi'
import { prisma } from '@/lib/prisma'
import { listSectorSuggestions } from '@/lib/sector-suggestions'
import { suggestRisqueExemples } from '@/lib/risque-exemples'
import { orgSectors } from '@/lib/sector-context.server'
import { toolText, type McpTool, type McpToolResult } from './protocol'
import type { McpContext } from './tools.server'
import { anchorExistsInOrg } from './anchors.server'
import { buildControlPlan, CONTROL_PLAN_PROFILES } from '@/lib/control-plan-template'

const MAX = 50
const LOCALES = ['fr', 'en', 'de', 'es', 'it'] as const
const clamp = (v: unknown, def: number) => { const n = typeof v === 'number' ? Math.floor(v) : NaN; return Number.isFinite(n) ? Math.min(MAX, Math.max(1, n)) : def }
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export const recommendRisksScenariosTool: McpTool<McpContext> = {
  name: 'recommend_risks_scenarios',
  description:
    "Recommande des risques (catalogue sectoriel des secteurs de l'organisation, hors ceux déjà au registre) et, si `analyseId` est fourni, " +
    "des scénarios et événements redoutés propres au secteur / sous-secteur de l'analyse (hors risques déjà saisis). Recommandations " +
    "calculées par ACRA (aucun LLM), en lecture seule : à qualifier, puis à déposer via un outil `propose_*` ancré. Pour un projet 360, " +
    "`projectRiskTypes` donne en plus le catalogue complet des risques types du projet (registre, sous-secteurs, architecture, secteur, " +
    "communs), avec domaine et cotation suggérée, hors risques déjà présents.",
  inputSchema: {
    type: 'object',
    properties: {
      analyseId: { type: 'string', description: "Analyse de l'organisation pour laquelle recommander des scénarios (facultatif)." },
      kinds: { type: 'array', items: { type: 'string', enum: ['RISK', 'SCENARIO'] }, description: 'Nature des recommandations (toutes si absent).' },
      limit: { type: 'integer', minimum: 1, maximum: MAX, description: 'Nombre maximum par liste (défaut 15).' },
      locale: { type: 'string', enum: [...LOCALES], description: 'Langue des libellés (défaut fr).' },
    },
    additionalProperties: false,
  },
  async handler(args, ctx): Promise<McpToolResult> {
    const limit = clamp(args.limit, 15)
    const locale = (LOCALES as readonly string[]).includes(String(args.locale)) ? (args.locale as (typeof LOCALES)[number]) : 'fr'
    const kinds = Array.isArray(args.kinds) && args.kinds.length ? args.kinds.map(String) : ['RISK', 'SCENARIO']
    const analyseId = typeof args.analyseId === 'string' ? args.analyseId : ''
    // Analyse bornée à l'organisation : hors périmètre → « introuvable » (aucune divulgation).
    if (analyseId && !(await anchorExistsInOrg('ANALYSE', analyseId, ctx.organizationId))) {
      return { content: [{ type: 'text', text: 'analyse_introuvable' }], isError: true }
    }

    const out: { organisationSectors: string[]; catalogueRisks: unknown[]; analysisScenarios: unknown[]; projectRiskTypes?: unknown[]; note: string } = {
      organisationSectors: [], catalogueRisks: [], analysisScenarios: [],
      note: 'Recommandations calculées par ACRA (aucun LLM) à partir du catalogue sectoriel : à qualifier par l’organisation, jamais des risques évalués.',
    }
    const { effective } = await orgSectors(ctx.organizationId)
    out.organisationSectors = effective

    if (kinds.includes('RISK')) {
      const existing = new Set((await prisma.riskItem.findMany({ where: { organizationId: ctx.organizationId, catalogueKey: { not: null } }, select: { catalogueKey: true } })).map(r => r.catalogueKey))
      out.catalogueRisks = listSectorSuggestions(effective, locale)
        .filter(i => i.kind === 'RISK' && !existing.has(i.key))
        .slice(0, limit)
        .map(i => ({ key: i.key, title: i.title, sector: i.sector, ...(i.description ? { description: i.description } : {}), ...(i.taxonomieCode ? { taxonomieCode: i.taxonomieCode } : {}) }))
    }

    if (kinds.includes('SCENARIO') && analyseId) {
      const analyse = await prisma.analyse.findFirst({ where: { id: analyseId, organizationId: ctx.organizationId, deletedAt: null }, select: { secteur: true, patternsArchi: true, sousSecteur: true, sousSecteurs: true } })
      const deja = new Set((await prisma.risque.findMany({ where: { analyse: { id: analyseId, organizationId: ctx.organizationId } }, select: { nom: true } })).map(r => fold(r.nom)))
      out.analysisScenarios = suggestRisqueExemples({ secteur: analyse?.secteur ?? null, sousSecteur: sousSecteursOf(analyse), patterns: patternsOf(analyse), locale, limit: MAX })
        .filter(s => !deja.has(fold(s.intitule)))
        .slice(0, limit)
        .map(s => ({ intitule: s.intitule, gravite: s.gravite, vraisemblance: s.vraisemblance }))
    }
    // Projet 360 : catalogue complet des risques types, comme l'import en phase d'identification (lib/risques-types.server).
    if (kinds.includes('SCENARIO') && analyseId) {
      const projet = await prisma.analyse.findFirst({ where: { id: analyseId, organizationId: ctx.organizationId, deletedAt: null }, select: { methode: true } })
      if (projet?.methode === 'PROJET_360') {
        const types = await catalogueRisquesTypesAnalyse(analyseId, ctx.organizationId, getT(locale).risquesDirects.risquesTransverses, locale)
        out.projectRiskTypes = types.filter(t => !t.present).slice(0, MAX_TYPES)
          .map(t => ({ origine: t.groupe, intitule: t.intitule, ...(t.description ? { description: t.description } : {}), ...(t.domaine ? { domaine: t.domaine } : {}), gravite: t.gravite, vraisemblance: t.vraisemblance }))
      }
    }
    return toolText(out)
  },
}

/** Plafond des risques types d'un projet renvoyés en une fois. */
const MAX_TYPES = 80

export const recommendControlPlanTool: McpTool<McpContext> = {
  name: 'recommend_control_plan',
  description:
    "Compose un plan de contrôle permanent ÉQUILIBRÉ pour un profil de métier (ex. MUTUELLE_SANTE) : un contrôle du catalogue par domaine " +
    "(gouvernance, honorabilité, LCB-FT, conseil, réclamations, données de santé, prestations, cotisations, délégataires, résilience TIC, " +
    "continuité, solvabilité, ORSA, provisions techniques, gel des avoirs), avec périodicité, type et référence. Calculé par ACRA (aucun LLM), en lecture seule ; à qualifier par l'organisation.",
  inputSchema: {
    type: 'object',
    properties: {
      profile: { type: 'string', enum: Object.keys(CONTROL_PLAN_PROFILES), description: 'Profil de métier (défaut MUTUELLE_SANTE).' },
      count: { type: 'integer', minimum: 1, maximum: 30, description: 'Nombre de contrôles (défaut : tous les domaines du profil, 15 pour MUTUELLE_SANTE).' },
      locale: { type: 'string', enum: [...LOCALES], description: 'Langue des libellés (défaut fr).' },
    },
    additionalProperties: false,
  },
  async handler(args): Promise<McpToolResult> {
    const profile = typeof args.profile === 'string' ? args.profile : 'MUTUELLE_SANTE'
    const locale = (LOCALES as readonly string[]).includes(String(args.locale)) ? (args.locale as (typeof LOCALES)[number]) : 'fr'
    const plan = buildControlPlan(profile, { count: typeof args.count === 'number' ? args.count : undefined, locale })
    if (!plan.controls.length) return { content: [{ type: 'text', text: `profil_inconnu — profils disponibles : ${plan.profiles.join(', ')}` }], isError: true }
    return toolText(plan)
  },
}
