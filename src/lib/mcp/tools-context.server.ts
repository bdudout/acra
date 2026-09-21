// ─── Outils MCP de CONTEXTE (phase 2, cf. docs/mcp-cadrage.md §10.2) ──────────
// Fournissent à l'agent le contexte nécessaire pour proposer (aux phases
// suivantes) : la TAXONOMIE EBIOS RM (vocabulaire méthode, non org-scopé), des
// EXEMPLES SECTORIELS (livrés, non org-scopés), et la POSTURE de l'organisation
// (synthèse LECTURE SEULE, STRICTEMENT org-scopée). Aucune écriture.

import { prisma } from '@/lib/prisma'
import {
  CRITERES_DICT, NIVEAUX_GRAVITE, NIVEAUX_VRAISEMBLANCE, CATEGORIES_BIENS_SUPPORTS,
  STRATEGIES_TRAITEMENT, ATELIERS_META,
} from '@/lib/ebios-data'
import { SECTOR_FAMILIES, sectorExemplesFor, type SectorExempleCategory } from '@/lib/exemples-sectoriels'
import { getRiskTier, type RiskTier } from '@/lib/risk-scale'
import type { Locale } from '@/lib/i18n/index'
import { toolText, type McpTool, type McpToolResult } from './protocol'
import type { McpContext } from './tools.server'

// Projections « propres » : on ne renvoie que la sémantique (value/label/desc),
// jamais l'habillage UI (couleurs Tailwind, emojis, icônes).
const pick = <T extends Record<string, unknown>>(rows: readonly T[], keys: string[]) =>
  rows.map(r => Object.fromEntries(keys.filter(k => k in r).map(k => [k, r[k]])))

/**
 * `read_taxonomie` — vocabulaire EBIOS RM de référence (critères de sécurité,
 * échelles gravité/vraisemblance, catégories de biens supports, stratégies de
 * traitement, ateliers). Données de MÉTHODE livrées (non spécifiques à une org).
 */
export const readTaxonomieTool: McpTool<McpContext> = {
  name: 'read_taxonomie',
  description:
    "Taxonomie EBIOS RM de référence : critères de sécurité (DICT), échelles de gravité et de " +
    "vraisemblance, catégories de biens supports, stratégies de traitement, et méta des 5 ateliers. " +
    "Vocabulaire de la méthode (non spécifique à une organisation), utile pour cadrer une proposition.",
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  async handler(): Promise<McpToolResult> {
    return toolText({
      criteresSecurite:     pick(CRITERES_DICT, ['value', 'label', 'desc']),
      niveauxGravite:       pick(NIVEAUX_GRAVITE, ['value', 'label', 'description']),
      niveauxVraisemblance: pick(NIVEAUX_VRAISEMBLANCE, ['value', 'label', 'description']),
      categoriesBiensSupports: pick(CATEGORIES_BIENS_SUPPORTS, ['value', 'label']),
      strategiesTraitement: pick(STRATEGIES_TRAITEMENT, ['value', 'label', 'description', 'conseil']),
      ateliers:             pick(ATELIERS_META, ['num', 'titre', 'sousTitre', 'etapes']),
    })
  },
}

const SECTOR_CATEGORIES: SectorExempleCategory[] =
  ['valeursMetier', 'biensSupports', 'evenementsRedoutes', 'sourcesRisque', 'scenariosStrategiques', 'partiesPrenantes']
const LOCALES: Locale[] = ['fr', 'en', 'it', 'es', 'de']

/**
 * `read_sector_examples` — exemples sectoriels livrés (valeurs métier, biens
 * supports, événements redoutés, sources de risque, scénarios, parties prenantes)
 * pour aider au pré-remplissage. Non org-scopé (catalogue de méthode). Sans
 * `secteur`, renvoie la liste des familles sectorielles disponibles.
 */
export const readSectorExamplesTool: McpTool<McpContext> = {
  name: 'read_sector_examples',
  description:
    "Exemples sectoriels livrés par catégorie EBIOS (valeurs métier, biens supports, événements " +
    "redoutés, sources de risque, scénarios stratégiques, parties prenantes). Fournir `secteur` " +
    "(et éventuellement `sousSecteur`, `category`, `locale`). Sans `secteur`, liste les familles disponibles.",
  inputSchema: {
    type: 'object',
    properties: {
      secteur: { type: 'string', description: "Libellé du secteur (ex. « santé », « finance »)." },
      sousSecteur: { type: 'string', description: 'Sous-secteur / profession (affine les exemples).' },
      category: { type: 'string', enum: SECTOR_CATEGORIES, description: 'Catégorie ciblée (toutes si absent).' },
      locale: { type: 'string', enum: LOCALES, description: 'Langue des libellés (défaut fr).' },
    },
    additionalProperties: false,
  },
  async handler(args): Promise<McpToolResult> {
    const secteur = typeof args.secteur === 'string' && args.secteur.trim() ? args.secteur.trim() : null
    const sousSecteur = typeof args.sousSecteur === 'string' ? args.sousSecteur : null
    const locale: Locale = LOCALES.includes(args.locale as Locale) ? (args.locale as Locale) : 'fr'

    if (!secteur) {
      // Découvrabilité : familles reconnues + motifs de correspondance.
      return toolText({
        secteur: null,
        famillesDisponibles: SECTOR_FAMILIES.map(f => ({ key: f.key, motifs: f.match })),
        categories: SECTOR_CATEGORIES,
      })
    }

    const wanted = SECTOR_CATEGORIES.includes(args.category as SectorExempleCategory)
      ? [args.category as SectorExempleCategory]
      : SECTOR_CATEGORIES
    const exemples: Record<string, unknown[]> = {}
    for (const cat of wanted) exemples[cat] = sectorExemplesFor(secteur, cat, locale, sousSecteur)
    const total = Object.values(exemples).reduce((n, a) => n + a.length, 0)
    return toolText({ secteur, sousSecteur: sousSecteur ?? undefined, locale, total, exemples })
  },
}

/** Compte des risques par palier (faible/modéré/élevé/critique) via `getRiskTier`. */
function bucketByTier(scores: (number | null | undefined)[]): Record<RiskTier, number> {
  const acc: Record<RiskTier, number> = { faible: 0, modere: 0, eleve: 0, critique: 0 }
  for (const s of scores) if (typeof s === 'number' && s > 0) acc[getRiskTier(s)]++
  return acc
}

/** Additionne les `_count` d'un groupBy Prisma dans un dictionnaire clé→total. */
function tally(rows: { _count: number }[], keyOf: (r: never) => string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) out[keyOf(r as never)] = (out[keyOf(r as never)] ?? 0) + r._count
  return out
}

/**
 * `read_risk_posture` — synthèse LECTURE SEULE de la posture de l'ORGANISATION de
 * la clé : analyses (par statut, statut des risques résiduels), risques (par
 * palier, initial et résiduel), plans d'action (par statut). STRICTEMENT
 * org-scopé ; ne renvoie aucun détail nominatif.
 */
export const readRiskPostureTool: McpTool<McpContext> = {
  name: 'read_risk_posture',
  description:
    "Synthèse (lecture seule) de la posture de risque de l'organisation : nombre d'analyses par " +
    "statut, statut des risques résiduels, répartition des risques par palier (initial et résiduel) " +
    "et plans d'action par statut. Agrégats uniquement, strictement bornés à l'organisation.",
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  async handler(_args, ctx): Promise<McpToolResult> {
    const orgId = ctx.organizationId
    const [byStatut, byResiduel, risques, plansByStatut, analysesTotal] = await Promise.all([
      prisma.analyse.groupBy({ by: ['statut'], where: { organizationId: orgId, deletedAt: null }, _count: true }),
      prisma.analyse.groupBy({ by: ['risquesResiduelsStatut'], where: { organizationId: orgId, deletedAt: null }, _count: true }),
      prisma.risque.findMany({
        where: { analyse: { organizationId: orgId, deletedAt: null } },
        select: { niveauRisque: true, niveauResiduel: true },
      }),
      prisma.planAction.groupBy({ by: ['statut'], where: { organizationId: orgId }, _count: true }),
      prisma.analyse.count({ where: { organizationId: orgId, deletedAt: null } }),
    ])

    return toolText({
      analyses: {
        total: analysesTotal,
        parStatut: tally(byStatut as never, (r: { statut: string }) => r.statut),
        risquesResiduels: tally(byResiduel as never, (r: { risquesResiduelsStatut: string }) => r.risquesResiduelsStatut),
      },
      risques: {
        total: risques.length,
        parNiveauInitial: bucketByTier(risques.map(r => r.niveauRisque)),
        parNiveauResiduel: bucketByTier(risques.map(r => r.niveauResiduel)),
      },
      plansAction: {
        total: plansByStatut.reduce((n, r) => n + (r as { _count: number })._count, 0),
        parStatut: tally(plansByStatut as never, (r: { statut: string }) => r.statut),
      },
    })
  },
}

/** Outils de contexte (phase 2) : taxonomie, exemples sectoriels, posture. */
export function buildContextTools(): McpTool<McpContext>[] {
  return [readTaxonomieTool, readSectorExamplesTool, readRiskPostureTool]
}
