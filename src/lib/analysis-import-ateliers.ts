/**
 * analysis-import-ateliers.ts — Contenu des ateliers 1 à 4 d'un paquet d'import canonique v3 (lot I5).
 * Extension rétro-compatible du paquet (risques, mesures, plans, liens) : cadrage et contexte, valeurs métier, biens supports,
 * événements redoutés, sources de risque, parties prenantes, scénarios stratégiques et opérationnels, socle de sécurité.
 * Les liens entre objets passent par les références externes, comparées sous leur FORME CANONIQUE (VM02 = VM_02).
 * Une référence introuvable ne crée aucun lien et est signalée : rien n'est inventé.
 */

import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { canonicalRef } from './import-transforms'
import { clampInt, IMPORT_MAX_ITEMS } from './import-sanitize'

const text = (max: number) => z.string().trim().max(max)
const ref = z.string().trim().min(1).max(255)
const refs = z.array(ref).max(200).default([])
const level = z.coerce.number().int().min(1).max(4)
const base = { externalId: ref.optional(), title: z.string().trim().min(1).max(500) }

export const atelierContentSchema = z.object({
  context: z.object({ perimetre: text(5000).optional(), contexteJuridique: text(5000).optional(), architecture: text(5000).optional(), objectifs: text(5000).optional() }).optional(),
  businessValues: z.array(z.object({ ...base, type: text(50).optional(), description: text(2000).optional(), responsible: text(200).optional(), justification: text(1000).optional(),
    needs: z.object({ availability: level.optional(), integrity: level.optional(), confidentiality: level.optional(), traceability: level.optional() }).optional() })).max(IMPORT_MAX_ITEMS).default([]),
  supportAssets: z.array(z.object({ ...base, category: text(50).optional(), description: text(2000).optional(), businessValueExternalIds: refs })).max(IMPORT_MAX_ITEMS).default([]),
  fearedEvents: z.array(z.object({ ...base, description: text(2000).optional(), impacts: text(2000).optional(), gravity: level.optional(), businessValueExternalIds: refs })).max(IMPORT_MAX_ITEMS).default([]),
  riskSources: z.array(z.object({ ...base, category: text(50).optional(), description: text(2000).optional(), motivation: level.optional(), resources: level.optional(), relevance: level.optional(), retained: z.boolean().optional(), justification: text(1000).optional(), objectives: z.array(text(500)).max(50).default([]) })).max(IMPORT_MAX_ITEMS).default([]),
  stakeholders: z.array(z.object({ ...base, type: text(50).optional(), description: text(2000).optional(), dependency: level.optional(), penetration: level.optional(), maturity: level.optional(), trust: level.optional() })).max(IMPORT_MAX_ITEMS).default([]),
  strategicScenarios: z.array(z.object({ ...base, description: text(2000).optional(), riskSourceExternalId: ref.optional(), riskSourceLabel: text(500).optional(), objective: text(500).optional(), fearedEventExternalIds: refs, stakeholderExternalIds: refs, gravity: level.optional(), likelihood: level.optional(), retained: z.boolean().optional(), attackPath: z.array(text(500)).max(50).default([]) })).max(IMPORT_MAX_ITEMS).default([]),
  operationalScenarios: z.array(z.object({ ...base, description: text(2000).optional(), strategicScenarioExternalId: ref.optional(), likelihood: level.optional(), gravity: level.optional() })).max(IMPORT_MAX_ITEMS).default([]),
  residualRisks: z.array(z.object({ externalId: ref.optional(), riskExternalId: ref, currentGravity: level.optional(), currentLikelihood: level.optional(), residualGravity: level.optional(), residualLikelihood: level.optional(), justification: text(1000).optional() })).max(IMPORT_MAX_ITEMS).default([]),
  securityBaseline: z.array(z.object({ externalId: ref.optional(), title: z.string().trim().min(1).max(1000), category: text(100).optional(), subCategory: text(100).optional(), coverage: z.coerce.number().int().min(0).max(3).optional(), comment: text(2000).optional() })).max(IMPORT_MAX_ITEMS).default([]),
})
export type AtelierContent = z.infer<typeof atelierContentSchema>

const CATEGORIES_SOURCE = ['CYBERCRIMINEL', 'ETAT_NATION', 'CONCURRENT', 'ACTIVISTE', 'EMPLOYE_MALVEILLANT', 'PRESTATAIRE', 'AMATEUR', 'TERRORISTE', 'AUTRE']
const TYPES_PP = ['FOURNISSEUR', 'CLIENT', 'PARTENAIRE', 'PRESTATAIRE', 'ORGANISME_REGULATION', 'AUTRE']
const TYPES_VM = ['PROCESSUS', 'INFORMATION']
const TYPES_BIEN = ['MATERIEL', 'LOGICIEL', 'RESEAU', 'PERSONNE', 'LOCAL', 'ORGANISATION', 'AUTRE']
const oneOf = (v: string | undefined, allowed: string[], fallback: string) => { const up = (v ?? '').toUpperCase(); return allowed.includes(up) ? up : fallback }

/** Rôles présents (au moins un objet) : sert au compte-rendu et à l'aperçu. */
export function hasAtelierContent(c: AtelierContent): boolean {
  return !!(c.context && Object.values(c.context).some(Boolean)) || [c.businessValues, c.supportAssets, c.fearedEvents, c.riskSources, c.stakeholders, c.strategicScenarios, c.operationalScenarios, c.securityBaseline, c.residualRisks].some(a => a.length > 0)
}

const countsOf = (c: AtelierContent) => Object.fromEntries(Object.entries({
  businessValues: c.businessValues.length, supportAssets: c.supportAssets.length, fearedEvents: c.fearedEvents.length, riskSources: c.riskSources.length,
  stakeholders: c.stakeholders.length, strategicScenarios: c.strategicScenarios.length, operationalScenarios: c.operationalScenarios.length, securityBaseline: c.securityBaseline.length, residualRisks: c.residualRisks.length,
}).filter(([, n]) => n > 0)) as Record<string, number>

/** Aperçu pur : volumes et références orphelines (jamais rattachées). */
export function summarizeAtelierContent(c: AtelierContent, riskRefs: string[] = []): { counts: Record<string, number>; warnings: string[] } {
  const set = (items: { externalId?: string }[]) => new Set(items.flatMap(i => (i.externalId ? [canonicalRef(i.externalId)] : [])))
  const vm = set(c.businessValues); const er = set(c.fearedEvents); const sr = set(c.riskSources); const pp = set(c.stakeholders); const ss = set(c.strategicScenarios)
  const risks = new Set(riskRefs.map(canonicalRef))
  const warnings: string[] = []
  const miss = (code: string, values: string[], known: Set<string>) => { for (const v of values) if (!known.has(canonicalRef(v))) warnings.push(`${code}:${v}`) }
  for (const a of c.supportAssets) miss('support_asset_business_value_not_found', a.businessValueExternalIds, vm)
  for (const e of c.fearedEvents) miss('feared_event_business_value_not_found', e.businessValueExternalIds, vm)
  for (const s of c.strategicScenarios) {
    if (s.riskSourceExternalId) miss('strategic_scenario_risk_source_not_found', [s.riskSourceExternalId], sr)
    miss('strategic_scenario_feared_event_not_found', s.fearedEventExternalIds, er)
    miss('strategic_scenario_stakeholder_not_found', s.stakeholderExternalIds, pp)
  }
  // Cohérence EBIOS RM : la gravité d'un scénario stratégique est le maximum des gravités des événements redoutés qu'il cite (avertissement, jamais de correction).
  const gravityByEr = new Map(c.fearedEvents.flatMap(e => (e.externalId && e.gravity ? [[canonicalRef(e.externalId), e.gravity] as const] : [])))
  for (const s of c.strategicScenarios) {
    const gs = s.fearedEventExternalIds.flatMap(r => { const g = gravityByEr.get(canonicalRef(r)); return g ? [g] : [] })
    if (s.gravity && gs.length && s.gravity !== Math.max(...gs)) warnings.push(`strategic_scenario_gravity_differs:${s.externalId ?? s.title}:${s.gravity}:${Math.max(...gs)}`)
  }
  for (const r of c.residualRisks) if (!risks.has(canonicalRef(r.riskExternalId))) warnings.push(`residual_risk_reference_not_found:${r.riskExternalId}`)
  for (const o of c.operationalScenarios) if (o.strategicScenarioExternalId) miss('operational_scenario_strategic_not_found', [o.strategicScenarioExternalId], ss)
  return { counts: countsOf(c), warnings }
}

type Tx = Prisma.TransactionClient

/** Écrit les ateliers 1 à 4 dans une analyse NOUVELLE (dont le cadrage vient d'être créé), au sein de la transaction de l'import. */
export async function writeAtelierContent(tx: Tx, c: AtelierContent, ctx: { analyseId: string; riskRefs?: string[] }): Promise<{ counts: Record<string, number>; warnings: string[] }> {
  const summary = summarizeAtelierContent(c, ctx.riskRefs)
  if (!hasAtelierContent(c)) return { counts: {}, warnings: [] }
  const uid = () => globalThis.crypto.randomUUID()
  const canon = (r: string) => canonicalRef(r)
  const idOf = (map: Map<string, string>, r: string | undefined) => (r ? map.get(canon(r)) : undefined)
  const idsOf = (map: Map<string, string>, rs: string[]) => [...new Set(rs.flatMap(r => { const id = idOf(map, r); return id ? [id] : [] }))]

  // Atelier 1 : cadrage (JSON) — valeurs métier → biens supports / événements redoutés → socle.
  const vmIds = new Map<string, string>()
  const valeursMetier = c.businessValues.map(v => {
    const id = uid(); if (v.externalId) vmIds.set(canon(v.externalId), id)
    return { id, nom: v.title, type: oneOf(v.type, TYPES_VM, 'PROCESSUS'), description: v.description ?? '', responsable: v.responsible ?? '', classification: 'NP',
      disponibilite: v.needs?.availability ?? 2, integrite: v.needs?.integrity ?? 2, confidentialite: v.needs?.confidentiality ?? 2, tracabilite: v.needs?.traceability ?? 2, ...(v.justification ? { justification: v.justification } : {}) }
  })
  const biensSupports = c.supportAssets.map(b => ({ id: uid(), nom: b.title, type: oneOf(b.category, TYPES_BIEN, 'MATERIEL'), description: b.description ?? '', valeurMetierIds: idsOf(vmIds, b.businessValueExternalIds) }))
  const erIds = new Map<string, string>()
  const evenementsRedoutes = c.fearedEvents.map(e => {
    const id = uid(); if (e.externalId) erIds.set(canon(e.externalId), id)
    return { id, description: e.description ? `${e.title} — ${e.description}` : e.title, impacts: e.impacts ?? '', categoriesImpacts: [], valeurMetierId: idsOf(vmIds, e.businessValueExternalIds)[0] ?? '', gravite: e.gravity ?? 3 }
  })
  const customControles = c.securityBaseline.map((s, i) => ({ ref: `IMP-${String(i + 1).padStart(3, '0')}`, nom: s.title, description: s.comment ?? '', type: 'ORGANISATIONNELLE', categorie: [s.category, s.subCategory].filter(Boolean).join(' / ') || s.category || '' }))
  const statutDe = (cov: number | undefined) => (cov === 3 ? 'conforme' : cov === 0 ? 'non_conforme' : cov === undefined ? 'na' : 'partiel')
  const socleSecurite = c.securityBaseline.map((s, i) => ({ ref: customControles[i].ref, statut: statutDe(s.coverage), ...(s.comment ? { commentaire: s.comment } : {}) }))
  const ctx1 = c.context
  await tx.cadrage.update({
    where: { analyseId: ctx.analyseId },
    data: {
      ...(ctx1?.perimetre ? { perimetre: ctx1.perimetre } : {}),
      ...(ctx1?.objectifs || ctx1?.contexteJuridique ? { objectifsEtude: [ctx1?.objectifs, ctx1?.contexteJuridique && `Contexte juridique et réglementaire : ${ctx1.contexteJuridique}`, ctx1?.architecture && `Architecture : ${ctx1.architecture}`].filter(Boolean).join('\n\n') } : ctx1?.architecture ? { objectifsEtude: `Architecture : ${ctx1.architecture}` } : {}),
      ...(valeursMetier.length ? { valeursMetier: valeursMetier as unknown as Prisma.InputJsonValue } : {}),
      ...(biensSupports.length ? { biensSupports: biensSupports as unknown as Prisma.InputJsonValue } : {}),
      ...(evenementsRedoutes.length ? { evenementsRedoutes: evenementsRedoutes as unknown as Prisma.InputJsonValue } : {}),
      ...(customControles.length ? { customControles: customControles as unknown as Prisma.InputJsonValue, socleSecurite: socleSecurite as unknown as Prisma.InputJsonValue } : {}),
    },
  })

  // Atelier 2 : sources de risque (avec objectifs visés) et parties prenantes.
  const srIds = new Map<string, string>()
  for (const s of c.riskSources) {
    const row = await tx.sourceRisque.create({ data: {
      analyseId: ctx.analyseId, nom: s.title, categorie: oneOf(s.category, CATEGORIES_SOURCE, 'AUTRE') as never, description: s.description,
      motivationScore: s.motivation, ressourcesScore: s.resources, pertinence: clampInt(s.relevance, 1, 4, 1) as number, retenu: s.retained ?? true, justification: s.justification,
      objectifsVises: s.objectives.map(nom => ({ id: uid(), nom })) as unknown as Prisma.InputJsonValue,
    }, select: { id: true } })
    if (s.externalId) srIds.set(canon(s.externalId), row.id)
  }
  const ppIds = new Map<string, string>()
  const ppNames = new Map<string, string>()
  for (const p of c.stakeholders) {
    const dependance = p.dependency ?? 2; const penetration = p.penetration ?? 2; const maturite = p.maturity ?? 3; const confiance = p.trust ?? 3
    const row = await tx.partiePrenante.create({ data: {
      analyseId: ctx.analyseId, nom: p.title, type: oneOf(p.type, TYPES_PP, 'AUTRE') as never, description: p.description,
      dependance, penetration, maturite, confiance, exposition: dependance * penetration, fiabilite: maturite * confiance,
    }, select: { id: true } })
    if (p.externalId) { ppIds.set(canon(p.externalId), row.id); ppNames.set(canon(p.externalId), p.title) }
  }

  // Atelier 3 : scénarios stratégiques ; atelier 4 : scénarios opérationnels.
  const ssIds = new Map<string, string>()
  for (const s of c.strategicScenarios) {
    const gravite = s.gravity ?? 2; const vraisemblance = s.likelihood ?? 2
    // Le modèle ne porte pas de lien direct scénario ↔ parties prenantes : leurs noms sont conservés dans la description.
    const impliquees = [...new Set(s.stakeholderExternalIds.flatMap(r => { const n = ppNames.get(canon(r)); return n ? [n] : [] }))]
    const sourceId = idOf(srIds, s.riskSourceExternalId)
    const description = [s.description, !sourceId && s.riskSourceLabel ? `Source de risque : ${s.riskSourceLabel}` : '', impliquees.length ? `Parties prenantes impliquées : ${impliquees.join(', ')}` : ''].filter(Boolean).join('\n') || undefined
    const row = await tx.scenarioStrategique.create({ data: {
      analyseId: ctx.analyseId, nom: s.title, description, objectifVise: s.objective, sourceRisqueId: sourceId,
      evenementsRedoutesIds: idsOf(erIds, s.fearedEventExternalIds) as unknown as Prisma.InputJsonValue,
      cheminAttaque: s.attackPath.map((action, i) => ({ etape: i + 1, partiePrenante: '', action, evenementIntermediaire: '' })) as unknown as Prisma.InputJsonValue,
      gravite, vraisemblance, niveauRisque: gravite * vraisemblance, retenu: s.retained ?? true,
    }, select: { id: true } })
    if (s.externalId) ssIds.set(canon(s.externalId), row.id)
  }
  for (const o of c.operationalScenarios) {
    await tx.scenarioOperationnel.create({ data: {
      analyseId: ctx.analyseId, nom: o.title, description: o.description, scenarioStrategiqueId: idOf(ssIds, o.strategicScenarioExternalId),
      vraisemblance: o.likelihood ?? 2, gravite: o.gravity ?? 2,
    }, select: { id: true } })
  }
  return summary
}
