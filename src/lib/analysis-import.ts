import { createHash } from 'crypto'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { clampInt, IMPORT_MAX_ITEMS } from '@/lib/import-sanitize'
import { getActiveMethodes } from '@/lib/interfaces-config.server'
import { resolveMethodes } from '@/lib/methodes'

const string = z.string().trim().min(1).max(255)
const externalId = z.string().trim().min(1).max(255)
const item = z.object({ externalId: externalId.optional(), title: string, description: z.string().max(2000).optional(), riskExternalId: externalId.optional(), gravity: z.coerce.number().int().min(1).max(4).optional(), likelihood: z.coerce.number().int().min(1).max(4).optional(), strategy: z.string().max(30).optional(), status: z.string().max(30).optional(), responsible: z.string().max(200).optional(), dueDate: z.string().max(40).optional() })
const schema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  analysis: z.object({ title: string.max(200), description: z.string().max(2000).optional(), methode: z.enum(['EBIOS_RM', 'ISO_27005', 'ISO_31000', 'NIST_800_30']).optional() }),
  risks: z.array(item).max(IMPORT_MAX_ITEMS).default([]),
  vulnerabilities: z.array(z.object({ externalId: externalId.optional(), riskExternalId: externalId, title: z.string().trim().min(1).max(500), description: z.string().max(2000).optional() })).max(IMPORT_MAX_ITEMS).default([]),
  measures: z.array(item).max(IMPORT_MAX_ITEMS).default([]),
  actions: z.array(item).max(IMPORT_MAX_ITEMS).default([]),
  links: z.array(z.object({ riskExternalId: z.string().trim().min(1).max(255), actionExternalId: z.string().trim().min(1).max(255) })).max(IMPORT_MAX_ITEMS).default([]),
})

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

export function parseAnalysisImportRequest(input: unknown): AnalysisImportRequest {
  const parsed = schema.parse(input)
  assertUniqueExternalIds(parsed.risks, 'risks')
  assertUniqueExternalIds(parsed.vulnerabilities, 'vulnerabilities')
  assertUniqueExternalIds(parsed.measures, 'measures')
  assertUniqueExternalIds(parsed.actions, 'actions')
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

/** Prévisualisation pure : expose les volumes et liens orphelins avant toute écriture. */
export function summarizeAnalysisImport(input: AnalysisImportRequest) {
  const riskIds = new Set(input.risks.flatMap(risk => risk.externalId ? [risk.externalId] : []))
  const actionIds = new Set(input.actions.flatMap(action => action.externalId ? [action.externalId] : []))
  const warnings = [
    ...input.vulnerabilities.filter(item => !riskIds.has(item.riskExternalId)).map(item => `vulnerability_risk_reference_not_found:${item.riskExternalId}`),
    ...input.measures.filter(item => item.riskExternalId && !riskIds.has(item.riskExternalId)).map(item => `measure_risk_reference_not_found:${item.riskExternalId}`),
    ...input.actions.filter(item => item.riskExternalId && !riskIds.has(item.riskExternalId)).map(item => `action_risk_reference_not_found:${item.riskExternalId}`),
    ...input.links.filter(link => !riskIds.has(link.riskExternalId) || !actionIds.has(link.actionExternalId)).map(link => `risk_action_link_reference_not_found:${link.riskExternalId}:${link.actionExternalId}`),
  ]
  return { analysis: input.analysis.title, created: { risks: input.risks.length, vulnerabilities: input.vulnerabilities.length, measures: input.measures.length, actions: input.actions.length, links: countImportLinks(input, riskIds, actionIds) }, warnings }
}

/** Empreinte canonique utilisée pour comparer deux demandes sous la même clé d'idempotence. */
export function analysisImportPayloadHash(input: AnalysisImportRequest) { return createHash('sha256').update(JSON.stringify(input)).digest('hex') }
function enumValue(value: string | undefined, allowed: readonly string[], fallback: string) { return value && allowed.includes(value) ? value : fallback }
function optionalDate(value: string | undefined) { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.valueOf()) ? date : null }
type StoredImportResponse = { analyseId: string; nom: string; created: { risks: number; vulnerabilities: number; measures: number; actions: number; links?: number }; warnings?: string[] }
function replayResult(receipt: { id: string; response: unknown }) { return { replayed: true, importId: receipt.id, ...(receipt.response as StoredImportResponse) } }
function isIdempotencyConflict(error: unknown) { return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' }

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
  const summary = summarizeAnalysisImport(input)
  try {
    const response = await prisma.$transaction(async tx => {
    const analyse = await tx.analyse.create({ data: { userId: ctx.userId, organizationId: ctx.organizationId, nom: input.analysis.title, description: input.analysis.description, methode, statut: 'EN_COURS', atelierCourant: 5, cadrage: { create: {} } }, select: { id: true, nom: true } })
    const risks = new Map<string, string>()
    for (const row of input.risks) {
      const gravity = clampInt(row.gravity, 1, 4, 2) as number
      const likelihood = clampInt(row.likelihood, 1, 4, 2) as number
      const vulnerabilities = input.vulnerabilities.filter(vulnerability => vulnerability.riskExternalId === row.externalId).map(vulnerability => ({ description: vulnerability.title, detail: vulnerability.description }))
      const risk = await tx.risque.create({ data: { analyseId: analyse.id, nom: row.title, description: row.description, gravite: gravity, vraisemblance: likelihood, niveauRisque: gravity * likelihood, strategie: enumValue(row.strategy, ['REDUIRE', 'ACCEPTER', 'TRANSFERER', 'REFUSER', 'SURVEILLER'], 'REDUIRE') as 'REDUIRE', vulnerabilites: vulnerabilities }, select: { id: true } })
      if (row.externalId) risks.set(row.externalId, risk.id)
    }
    for (const row of input.measures) await tx.mesure.create({ data: { analyseId: analyse.id, risqueId: row.riskExternalId ? risks.get(row.riskExternalId) : null, nom: row.title, description: row.description, statut: enumValue(row.status, ['A_FAIRE', 'EN_COURS', 'REALISE', 'REPORTE'], 'REALISE') as 'REALISE', responsable: row.responsible, echeance: optionalDate(row.dueDate) } })
    const actions = new Map<string, string>()
    const linkedActionRisks = new Set<string>()
    for (const row of input.actions) {
      const riskId = row.riskExternalId ? risks.get(row.riskExternalId) : undefined
      const action = await tx.planAction.create({ data: { organizationId: ctx.organizationId, titre: row.title, description: row.description, porteur: row.responsible, echeance: optionalDate(row.dueDate), createdById: ctx.userId }, select: { id: true } })
      if (riskId) {
        await tx.planActionLien.create({ data: { planActionId: action.id, type: 'RISQUE_ANALYSE', targetId: riskId, label: row.title } })
        linkedActionRisks.add(`${action.id}:${riskId}`)
      }
      if (row.externalId) actions.set(row.externalId, action.id)
    }
    for (const link of input.links) {
      const riskId = risks.get(link.riskExternalId); const actionId = actions.get(link.actionExternalId)
      if (riskId && actionId && !linkedActionRisks.has(`${actionId}:${riskId}`)) {
        await tx.planActionLien.create({ data: { planActionId: actionId, type: 'RISQUE_ANALYSE', targetId: riskId } })
        linkedActionRisks.add(`${actionId}:${riskId}`)
      }
    }
    const data = { analyseId: analyse.id, nom: analyse.nom, created: summary.created, warnings: summary.warnings }
    const receipt = await tx.analysisImport.create({ data: { organizationId: ctx.organizationId, idempotencyKey: input.idempotencyKey, source: ctx.source, payloadHash, analyseId: analyse.id, response: data }, select: { id: true } })
    return { ...data, importId: receipt.id }
    })
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
    const risks = new Map<string, string>()
    for (const row of input.risks) {
      const gravity = clampInt(row.gravity, 1, 4, 2) as number; const likelihood = clampInt(row.likelihood, 1, 4, 2) as number
      const vulnerabilities = input.vulnerabilities.filter(vulnerability => vulnerability.riskExternalId === row.externalId).map(vulnerability => ({ description: vulnerability.title, detail: vulnerability.description }))
      const risk = await tx.risque.create({ data: { analyseId: ctx.analyseId, nom: row.title, description: row.description, gravite: gravity, vraisemblance: likelihood, niveauRisque: gravity * likelihood, strategie: enumValue(row.strategy, ['REDUIRE', 'ACCEPTER', 'TRANSFERER', 'REFUSER', 'SURVEILLER'], 'REDUIRE') as 'REDUIRE', vulnerabilites: vulnerabilities }, select: { id: true } })
      if (row.externalId) risks.set(row.externalId, risk.id)
    }
    for (const row of input.measures) await tx.mesure.create({ data: { analyseId: ctx.analyseId, risqueId: row.riskExternalId ? risks.get(row.riskExternalId) : null, nom: row.title, description: row.description, statut: enumValue(row.status, ['A_FAIRE', 'EN_COURS', 'REALISE', 'REPORTE'], 'REALISE') as 'REALISE', responsable: row.responsible, echeance: optionalDate(row.dueDate) } })
    const actions = new Map<string, string>()
    const linkedActionRisks = new Set<string>()
    for (const row of input.actions) {
      const riskId = row.riskExternalId ? risks.get(row.riskExternalId) : undefined
      const action = await tx.planAction.create({ data: { organizationId: ctx.organizationId, titre: row.title, description: row.description, porteur: row.responsible, echeance: optionalDate(row.dueDate), createdById: ctx.userId }, select: { id: true } })
      if (riskId) {
        await tx.planActionLien.create({ data: { planActionId: action.id, type: 'RISQUE_ANALYSE', targetId: riskId, label: row.title } })
        linkedActionRisks.add(`${action.id}:${riskId}`)
      }
      if (row.externalId) actions.set(row.externalId, action.id)
    }
    for (const link of input.links) {
      const riskId = risks.get(link.riskExternalId); const actionId = actions.get(link.actionExternalId)
      if (riskId && actionId && !linkedActionRisks.has(`${actionId}:${riskId}`)) {
        await tx.planActionLien.create({ data: { planActionId: actionId, type: 'RISQUE_ANALYSE', targetId: riskId } })
        linkedActionRisks.add(`${actionId}:${riskId}`)
      }
    }
    const summary = summarizeAnalysisImport(input)
    return { analyseId: ctx.analyseId, created: summary.created, warnings: summary.warnings }
  })
}
