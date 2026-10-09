import { createHash } from 'crypto'
import { MAX_SOUS_SECTEURS, resolveSousSecteursUpdate } from '@/lib/sous-secteurs'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { clampInt, IMPORT_MAX_ITEMS } from '@/lib/import-sanitize'
import { getActiveMethodes } from '@/lib/interfaces-config.server'
import { resolveMethodes } from '@/lib/methodes'
import { canonicalRef } from '@/lib/import-transforms'
import { truncateStringsBySchema } from '@/lib/import-truncate'
import { atelierContentSchema, hasAtelierContent, writeAtelierContent } from '@/lib/analysis-import-ateliers'
import { normalizePatterns, PATTERNS_MAX_MAX } from '@/lib/patterns-archi'
import { divergencesNiveauRisque } from '@/lib/import-niveau-risque'
import { getEffectiveScaleConfig } from '@/lib/configuration-server'
import type { ScaleConfig } from '@/lib/risk-scale'

const string = z.string().trim().min(1).max(255)
const externalId = z.string().trim().min(1).max(255)
const item = z.object({ externalId: externalId.optional(), title: string, description: z.string().max(2000).optional(), riskExternalId: externalId.optional(), gravity: z.coerce.number().int().min(1).max(4).optional(), likelihood: z.coerce.number().int().min(1).max(4).optional(), riskLevel: z.string().trim().max(60).optional(), strategy: z.string().max(30).optional(), status: z.string().max(30).optional(), responsible: z.string().max(200).optional(), dueDate: z.string().max(40).optional() })
const schema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  analysis: z.object({ title: string.max(200), description: z.string().max(2000).optional(), methode: z.enum(['EBIOS_RM', 'ISO_27005', 'ISO_31000', 'NIST_800_30']).optional(), patternsArchi: z.array(z.string().max(60)).max(PATTERNS_MAX_MAX).optional(), secteur: z.string().trim().max(120).optional(), sousSecteurs: z.array(z.string().max(60)).max(MAX_SOUS_SECTEURS * 2).optional() }),
  risks: z.array(item).max(IMPORT_MAX_ITEMS).default([]),
  vulnerabilities: z.array(z.object({ externalId: externalId.optional(), riskExternalId: externalId, title: z.string().trim().min(1).max(500), description: z.string().max(2000).optional() })).max(IMPORT_MAX_ITEMS).default([]),
  measures: z.array(item).max(IMPORT_MAX_ITEMS).default([]),
  actions: z.array(item).max(IMPORT_MAX_ITEMS).default([]),
  links: z.array(z.object({ riskExternalId: z.string().trim().min(1).max(255), actionExternalId: z.string().trim().min(1).max(255) })).max(IMPORT_MAX_ITEMS).default([]),
}).extend(atelierContentSchema.shape)

export type AnalysisImportRequest = z.infer<typeof schema>

/** Les références externes sont les seules clés de rapprochement : elles doivent être uniques. */
function assertUniqueExternalIds(items: Array<{ externalId?: string }>, collection: string) {
  const seen = new Set<string>()
  for (const item of items) {
    if (!item.externalId) continue
    if (seen.has(item.externalId)) throw new Error(`duplicate_external_id:${collection}:${item.externalId}`)
    seen.add(item.externalId)
  }
}

/** Raccourcit les textes dépassant les plafonds du schéma (avant validation) ; renvoie aussi la liste des troncatures. */
export function truncateImportRequest(input: unknown) { return truncateStringsBySchema(schema, input) }

export function parseAnalysisImportRequest(input: unknown): AnalysisImportRequest {
  const parsed = schema.parse(input)
  parsed.analysis.patternsArchi = normalizePatterns(parsed.analysis.patternsArchi, { max: PATTERNS_MAX_MAX })
  assertUniqueExternalIds(parsed.risks, 'risks')
  assertUniqueExternalIds(parsed.vulnerabilities, 'vulnerabilities')
  assertUniqueExternalIds(parsed.measures, 'measures')
  assertUniqueExternalIds(parsed.actions, 'actions')
  for (const key of ['businessValues', 'supportAssets', 'fearedEvents', 'riskSources', 'stakeholders', 'strategicScenarios', 'operationalScenarios'] as const) {
    // Deux références qui ne diffèrent que par l'écriture (VM02 / VM_02) désignent le même objet : doublon.
    assertUniqueExternalIds(parsed[key].map(i => ({ externalId: i.externalId ? canonicalRef(i.externalId) : undefined })), key)
  }
  return parsed
}

/** Compte les liens effectivement créables, sans compter deux fois un même rattachement. */
function countImportLinks(input: AnalysisImportRequest, riskIds: Set<string>, actionIds: Set<string>) {
  const links = new Set<string>()
  input.actions.forEach((action, index) => {
    if (!action.riskExternalId || !riskIds.has(action.riskExternalId)) return
    links.add(`${action.externalId ?? `row-${index}`}:${action.riskExternalId}`)
  })
  for (const link of input.links) {
    if (riskIds.has(link.riskExternalId) && actionIds.has(link.actionExternalId)) {
      links.add(`${link.actionExternalId}:${link.riskExternalId}`)
    }
  }
  return links.size
}

/**
 * Prévisualisation pure : expose les volumes et liens orphelins avant toute écriture, et les niveaux de risque du fichier
 * qui divergent du calcul ACRA avec les échelles de l'organisation (B-IMP-09 : avertissement seulement).
 */
export function summarizeAnalysisImport(input: AnalysisImportRequest, echelles?: Partial<ScaleConfig> | null) {
  const riskIds = new Set(input.risks.flatMap(risk => risk.externalId ? [risk.externalId] : []))
  const actionIds = new Set(input.actions.flatMap(action => action.externalId ? [action.externalId] : []))
  const warnings = [
    ...input.vulnerabilities.filter(item => !riskIds.has(item.riskExternalId)).map(item => `vulnerability_risk_reference_not_found:${item.riskExternalId}`),
    ...input.measures.filter(item => item.riskExternalId && !riskIds.has(item.riskExternalId)).map(item => `measure_risk_reference_not_found:${item.riskExternalId}`),
    ...input.actions.filter(item => item.riskExternalId && !riskIds.has(item.riskExternalId)).map(item => `action_risk_reference_not_found:${item.riskExternalId}`),
    ...input.links.filter(link => !riskIds.has(link.riskExternalId) || !actionIds.has(link.actionExternalId)).map(link => `risk_action_link_reference_not_found:${link.riskExternalId}:${link.actionExternalId}`),
    ...divergencesNiveauRisque(input.risks, echelles),
  ]
  return { analysis: input.analysis.title, created: { risks: input.risks.length, vulnerabilities: input.vulnerabilities.length, measures: input.measures.length, actions: input.actions.length, links: countImportLinks(input, riskIds, actionIds) }, warnings }
}

/** Empreinte canonique utilisée pour comparer deux demandes sous la même clé d'idempotence. */
const ATELIER_KEYS = ['context', 'businessValues', 'supportAssets', 'fearedEvents', 'riskSources', 'stakeholders', 'strategicScenarios', 'operationalScenarios', 'securityBaseline', 'residualRisks'] as const
/**
 * Un paquet SANS contenu d'atelier garde l'empreinte d'avant le format v3 : les reçus d'idempotence déjà enregistrés
 * restent rejouables (même clé + même contenu = rejeu, jamais un faux 409).
 */
export function analysisImportPayloadHash(input: AnalysisImportRequest) {
  const canonical: Record<string, unknown> = { ...input }
  if (!hasAtelierContent(input)) for (const key of ATELIER_KEYS) delete canonical[key]
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}
function enumValue(value: string | undefined, allowed: readonly string[], fallback: string) { return value && allowed.includes(value) ? value : fallback }
function optionalDate(value: string | undefined) { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.valueOf()) ? date : null }
type StoredImportResponse = { analyseId: string; nom: string; created: { risks: number; vulnerabilities: number; measures: number; actions: number; links?: number }; warnings?: string[]; ateliers?: Record<string, number> }
function replayResult(receipt: { id: string; response: unknown }) { return { replayed: true, importId: receipt.id, ...(receipt.response as StoredImportResponse) } }
function isIdempotencyConflict(error: unknown) { return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' }

/**
 * Délai des transactions d'import : jusqu'à 4 × IMPORT_MAX_ITEMS écritures
 * séquentielles (le défaut Prisma de 5 s annulerait un gros classeur).
 */
const IMPORT_TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 } as const

/**
 * Écrit le contenu d'un paquet (risques + vulnérabilités, mesures, plans d'action
 * et liens) dans une analyse, au sein d'une transaction. Source UNIQUE pour
 * l'import (nouvelle analyse) et l'application MCP (analyse existante).
 * Contrat des liens `RISQUE_ANALYSE` : targetId = Risque.id ET ref = analyseId
 * (sans ref, le plan est invisible dans les compteurs du registre et son lien
 * profond est cassé).
 */
async function writeImportContent(tx: Prisma.TransactionClient, input: AnalysisImportRequest, ctx: { analyseId: string; organizationId: string; userId: string }) {
  const risks = new Map<string, string>()
  for (const row of input.risks) {
    const gravity = clampInt(row.gravity, 1, 4, 2) as number
    const likelihood = clampInt(row.likelihood, 1, 4, 2) as number
    const vulnerabilities = input.vulnerabilities.filter(vulnerability => vulnerability.riskExternalId === row.externalId).map(vulnerability => ({ description: vulnerability.title, detail: vulnerability.description }))
    const risk = await tx.risque.create({ data: { analyseId: ctx.analyseId, nom: row.title, description: row.description, gravite: gravity, vraisemblance: likelihood, niveauRisque: gravity * likelihood, strategie: enumValue(row.strategy, ['REDUIRE', 'ACCEPTER', 'TRANSFERER', 'REFUSER', 'SURVEILLER'], 'REDUIRE') as 'REDUIRE', vulnerabilites: vulnerabilities }, select: { id: true } })
    if (row.externalId) risks.set(row.externalId, risk.id)
  }
  // Cotations « actuelle » et « résiduelle » (feuille de risques résiduels), rattachées aux risques par référence canonique.
  const canonicalRisks = new Map([...risks].map(([ref, id]) => [canonicalRef(ref), id]))
  for (const r of input.residualRisks) {
    const id = canonicalRisks.get(canonicalRef(r.riskExternalId)); if (!id) continue
    await tx.risque.update({ where: { id }, data: {
      ...(r.currentGravity && r.currentLikelihood ? { graviteActuelle: r.currentGravity, vraisemblanceActuelle: r.currentLikelihood, niveauActuel: r.currentGravity * r.currentLikelihood } : {}),
      ...(r.residualGravity && r.residualLikelihood ? { graviteResiduelle: r.residualGravity, vraisemblanceResiduelle: r.residualLikelihood, niveauResiduel: r.residualGravity * r.residualLikelihood } : {}),
      ...(r.justification ? { justificationResiduelle: r.justification } : {}),
    } })
  }
  for (const row of input.measures) await tx.mesure.create({ data: { analyseId: ctx.analyseId, risqueId: row.riskExternalId ? risks.get(row.riskExternalId) : null, nom: row.title, description: row.description, statut: enumValue(row.status, ['A_FAIRE', 'EN_COURS', 'REALISE', 'REPORTE'], 'REALISE') as 'REALISE', responsable: row.responsible, echeance: optionalDate(row.dueDate) } })
  const actions = new Map<string, string>()
  const linked = new Set<string>()
  const link = async (planActionId: string, riskId: string, label?: string) => {
    if (linked.has(`${planActionId}:${riskId}`)) return
    await tx.planActionLien.create({ data: { planActionId, type: 'RISQUE_ANALYSE', targetId: riskId, ref: ctx.analyseId, ...(label ? { label } : {}) } })
    linked.add(`${planActionId}:${riskId}`)
  }
  for (const row of input.actions) {
    const riskId = row.riskExternalId ? risks.get(row.riskExternalId) : undefined
    const action = await tx.planAction.create({ data: { organizationId: ctx.organizationId, titre: row.title, description: row.description, porteur: row.responsible, echeance: optionalDate(row.dueDate), createdById: ctx.userId }, select: { id: true } })
    if (riskId) await link(action.id, riskId, row.title)
    if (row.externalId) actions.set(row.externalId, action.id)
  }
  for (const l of input.links) {
    const riskId = risks.get(l.riskExternalId); const actionId = actions.get(l.actionExternalId)
    if (riskId && actionId) await link(actionId, riskId)
  }
}

/** Écrit une analyse historique et son reçu d'idempotence dans une seule transaction. */
export async function executeAnalysisImport(input: AnalysisImportRequest, ctx: { organizationId: string; userId: string; source: 'API_V2' | 'EXCEL_WEB' | 'MCP' }) {
  const payloadHash = analysisImportPayloadHash(input)
  const previous = await prisma.analysisImport.findUnique({ where: { organizationId_idempotencyKey: { organizationId: ctx.organizationId, idempotencyKey: input.idempotencyKey } } })
  if (previous) {
    if (previous.payloadHash !== payloadHash) throw new Error('IDEMPOTENCY_KEY_REUSED')
    return replayResult(previous)
  }
  const configured = resolveMethodes({ instanceEnabled: await getActiveMethodes() })
  const methode = input.analysis.methode && configured.available.includes(input.analysis.methode) ? input.analysis.methode : configured.default
  const summary = summarizeAnalysisImport(input, await getEffectiveScaleConfig(ctx.organizationId))
  try {
    const response = await prisma.$transaction(async tx => {
    // Secteur et sous-secteurs (cohérents avec le secteur) ; hors EBIOS RM, le contexte du paquet initialise le cadrage
    // (en EBIOS RM, l'atelier 1 l'écrit avec le reste du contenu des ateliers).
    const secteur = input.analysis.secteur || undefined
    const cadrageInitial = methode !== 'EBIOS_RM' && input.context
      ? { ...(input.context.perimetre ? { perimetre: input.context.perimetre } : {}), ...(input.context.objectifs ? { objectifsEtude: input.context.objectifs } : {}) }
      : {}
    const analyse = await tx.analyse.create({ data: {
      userId: ctx.userId, organizationId: ctx.organizationId, nom: input.analysis.title, description: input.analysis.description, methode,
      patternsArchi: input.analysis.patternsArchi ?? [], statut: 'EN_COURS', atelierCourant: 5,
      ...(secteur ? { secteur, ...resolveSousSecteursUpdate({ secteur, input: { sousSecteurs: input.analysis.sousSecteurs } }) } : {}),
      cadrage: { create: cadrageInitial },
    }, select: { id: true, nom: true } })
    // Les ateliers 1 à 4 ne concernent que la méthode EBIOS RM : une autre méthode ne reçoit pas ces objets (signalé).
    const ateliers = methode === 'EBIOS_RM' ? await writeAtelierContent(tx, input, { analyseId: analyse.id, riskRefs: input.risks.flatMap(risk => (risk.externalId ? [risk.externalId] : [])) }) : { counts: {}, warnings: hasAtelierContent(input) ? ['atelier_content_ignored_method'] : [] }
    await writeImportContent(tx, input, { analyseId: analyse.id, organizationId: ctx.organizationId, userId: ctx.userId })
    const data = { analyseId: analyse.id, nom: analyse.nom, created: summary.created, warnings: [...summary.warnings, ...ateliers.warnings], ...(Object.keys(ateliers.counts).length ? { ateliers: ateliers.counts } : {}) }
    const receipt = await tx.analysisImport.create({ data: { organizationId: ctx.organizationId, idempotencyKey: input.idempotencyKey, source: ctx.source, payloadHash, analyseId: analyse.id, response: data }, select: { id: true } })
    return { ...data, importId: receipt.id }
    }, IMPORT_TX_OPTIONS)
    return { replayed: false, ...response }
  } catch (error) {
    // Deux requêtes peuvent passer le premier lookup simultanément. La contrainte
    // unique annule entièrement la transaction perdante ; on renvoie alors le reçu
    // gagnant, sans jamais recréer d'analyse.
    if (!isIdempotencyConflict(error)) throw error
    const raced = await prisma.analysisImport.findUnique({ where: { organizationId_idempotencyKey: { organizationId: ctx.organizationId, idempotencyKey: input.idempotencyKey } } })
    if (!raced) throw error
    if (raced.payloadHash !== payloadHash) throw new Error('IDEMPOTENCY_KEY_REUSED')
    return replayResult(raced)
  }
}

/** Applique uniquement le contenu d'un paquet sur une analyse existante (MCP validé). */
export async function applyAnalysisImportContent(input: AnalysisImportRequest, ctx: { organizationId: string; userId: string; analyseId: string }) {
  return prisma.$transaction(async tx => {
    await writeImportContent(tx, input, ctx)
    const summary = summarizeAnalysisImport(input, await getEffectiveScaleConfig(ctx.organizationId))
    return { analyseId: ctx.analyseId, created: summary.created, warnings: summary.warnings }
  }, IMPORT_TX_OPTIONS)
}
