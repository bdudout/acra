/**
 * import-ateliers-build.ts — Rôles de feuille des ateliers 1 à 4 et construction du contenu d'atelier (lot I5). Module PUR.
 * Feuilles (déjà lues et mappées) → paquet canonique v3 (`AtelierContent`). Réutilise les transformations de l'I3 :
 * références canoniques et listes, niveaux « N - libellé », symboles « + », dictionnaires de valeurs, regroupement, retenu.
 * Rien n'est deviné : références introuvables, valeurs par défaut (AUTRE) et divergences sont rapportées.
 */

import { atelierContentSchema, type AtelierContent } from './analysis-import-ateliers'
import {
  extractReferences, extractReferencesWithLabels, filterRetained, groupRows, normalizeRetained, parseLevelLabel, parseSymbolLevel, suggestValueMap,
  type RetainedMode,
} from './import-transforms'

export const ATELIER_ROLES = ['BUSINESS_VALUES', 'SUPPORT_ASSETS', 'FEARED_EVENTS', 'RISK_SOURCES', 'STAKEHOLDERS', 'STRATEGIC_SCENARIOS', 'OPERATIONAL_SCENARIOS', 'SECURITY_BASELINE'] as const
export type AtelierRole = (typeof ATELIER_ROLES)[number]

/** Champs ACRA proposés par rôle (ordre d'affichage). */
export const ATELIER_ROLE_FIELDS: Record<AtelierRole, string[]> = {
  BUSINESS_VALUES: ['externalId', 'title', 'type', 'description', 'responsible', 'availability', 'integrity', 'confidentiality', 'justification'],
  SUPPORT_ASSETS: ['externalId', 'title', 'category', 'description', 'businessValueRefs', 'retained'],
  FEARED_EVENTS: ['externalId', 'title', 'description', 'impacts', 'gravity', 'businessValueRefs', 'retained'],
  RISK_SOURCES: ['externalId', 'title', 'objective', 'motivation', 'resources', 'relevance', 'retained', 'justification'],
  STAKEHOLDERS: ['externalId', 'title', 'type', 'description', 'dependency', 'penetration', 'maturity', 'trust'],
  STRATEGIC_SCENARIOS: ['externalId', 'title', 'riskSource', 'objective', 'attackPath', 'stakeholderRefs', 'fearedEventRefs', 'gravity', 'description'],
  OPERATIONAL_SCENARIOS: ['externalId', 'strategicRef', 'title', 'likelihood'],
  SECURITY_BASELINE: ['title', 'category', 'subCategory', 'coverage', 'comment'],
}

/** Rôles dont un champ est une liste de références vers une autre feuille. */
export const ATELIER_REF_FIELDS = ['businessValueRefs', 'stakeholderRefs', 'fearedEventRefs', 'strategicRef']

export function defaultRetainedMode(role: AtelierRole): RetainedMode {
  return role === 'SUPPORT_ASSETS' || role === 'FEARED_EVENTS' ? 'ONLY_RETAINED' : 'ALL'
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// ─── Détection ───────────────────────────────────────────────────────────────

/** Rôle d'atelier d'une feuille, d'après la colonne de référence à préfixe (Réf.VM, Réf.ER…) ; null si aucun. */
export function detectAtelierRole(_name: string, columns: string[]): { type: AtelierRole; confidence: 'HIGH'; missing: string[] } | null {
  const h = columns.map(norm)
  const has = (x: string) => h.includes(x)
  // Feuilles de risques (Réf.RI / Réf.RR) : rôle « Risques » décidé ailleurs ; elles citent Réf.SS / Réf.SO sans en être.
  if (has('ref ri') || has('ref rr')) return null
  const role: AtelierRole | null = has('ref vm') ? 'BUSINESS_VALUES' : has('ref er') ? 'FEARED_EVENTS' : has('ref bs') ? 'SUPPORT_ASSETS' : has('ref pp') ? 'STAKEHOLDERS'
    : has('ref sr ov') ? 'RISK_SOURCES' : has('ref so') ? 'OPERATIONAL_SCENARIOS' : has('ref ss') ? 'STRATEGIC_SCENARIOS'
      : has('exigence') && h.some(x => x.startsWith('couverture')) ? 'SECURITY_BASELINE' : null
  return role ? { type: role, confidence: 'HIGH', missing: [] } : null
}

const ALIASES: Record<AtelierRole, Record<string, string[]>> = {
  BUSINESS_VALUES: { externalId: ['ref vm'], title: ['denomination', 'designation', 'intitule', 'nom'], type: ['nature'], description: ['description'], responsible: ['responsable'], availability: ['disponibilite'], integrity: ['integrite'], confidentiality: ['confidentialite'], justification: ['justification'] },
  SUPPORT_ASSETS: { externalId: ['ref bs'], title: ['bien support'], category: ['categorie'], description: ['description'], businessValueRefs: ['valeur s metier', 'valeur metier'], retained: ['retenu'] },
  FEARED_EVENTS: { externalId: ['ref er'], title: ['intitule'], description: ['description'], impacts: ['impacts'], gravity: ['gravite'], businessValueRefs: ['valeur s metier', 'valeur metier'], retained: ['retenu'] },
  RISK_SOURCES: { externalId: ['ref sr ov'], title: ['sources de risques', 'source de risque', 'source'], objective: ['objectifs vises', 'objectif vise'], motivation: ['motivation'], resources: ['ressources'], relevance: ['pertinence'], retained: ['retenu'], justification: ['justification'] },
  STAKEHOLDERS: { externalId: ['ref pp'], type: ['categorie'], title: ['partie prenante'], description: ['activites'], dependency: ['dependance'], penetration: ['penetration'], maturity: ['maturite'], trust: ['confiance'] },
  STRATEGIC_SCENARIOS: { externalId: ['ref ss'], title: ['scenario strategique'], riskSource: ['sources de risques', 'source de risque'], objective: ['objectifs vises', 'objectif vise'], attackPath: ['chemins d attaque', 'chemin d attaque'], stakeholderRefs: ['partie prenante'], fearedEventRefs: ['evenements redoutes'], gravity: ['gravite'], description: ['commentaire'] },
  OPERATIONAL_SCENARIOS: { externalId: ['ref so'], strategicRef: ['ref ss'], title: ['description du scenario'], likelihood: ['vraisemblance initiale', 'vraisemblance'] },
  SECURITY_BASELINE: { title: ['description', 'exigence'], category: ['categorie'], subCategory: ['sous categorie'], coverage: ['couverture projet', 'couverture'], comment: ['commentaire'] },
}

/** Mapping suggéré (champ ACRA → en-tête) : correspondance exacte d'abord, puis inclusion ; une colonne n'est utilisée qu'une fois. */
export function suggestAtelierMapping(role: AtelierRole, columns: string[]): Record<string, string> {
  const normalized = columns.map(c => ({ raw: c, n: norm(c) }))
  const used = new Set<string>()
  const out: Record<string, string> = {}
  for (const field of ATELIER_ROLE_FIELDS[role]) {
    for (const alias of ALIASES[role][field] ?? []) {
      const hit = normalized.find(c => !used.has(c.raw) && c.n === alias) ?? normalized.find(c => !used.has(c.raw) && c.n.includes(alias))
      if (hit) { out[field] = hit.raw; used.add(hit.raw); break }
    }
  }
  return out
}

// ─── Construction du contenu ─────────────────────────────────────────────────

export interface AtelierSheet { name: string; type: AtelierRole; mapping: Record<string, string | undefined>; rows: Record<string, string>[]; retainedMode?: RetainedMode }
export interface AtelierBuildReport {
  /** Valeurs remplacées par la valeur neutre (AUTRE) faute de correspondance : à relire. */
  defaulted: { sheet: string; field: string; source: string; value: string }[]
  /** Colonnes propres à un parent (source de risque) dont les lignes diffèrent : la première valeur est gardée. */
  conflicts: { sheet: string; key: string; column: string; values: string[] }[]
  notRetained: Partial<Record<AtelierRole, number>>
}

const SEP = '\u001F'
const cellOf = (row: Record<string, string>, column: string | undefined): string => (column ? column.split(SEP).map(c => (row[c] ?? '').trim()).filter(Boolean).join('\n') : '')
const level = (value: string, max = 4): number | undefined => {
  const l = parseLevelLabel(value)
  const n = l ? l.level : Number(value.replace(',', '.'))
  return Number.isFinite(n) && n >= 1 && n <= max ? Math.round(n) : undefined
}
const symbolOrLevel = (value: string): number | undefined => parseSymbolLevel(value, 4) ?? level(value)
const prefixesOf = (refs: string[]) => [...new Set(refs.flatMap(r => { const m = /^([A-Za-z][A-Za-z/]*)[ _.\-]?\d/.exec(r.trim()); return m ? [m[1].toUpperCase()] : [] }))]
const inferPrefixes = (values: string[]) => [...new Set(values.flatMap(v => [...v.matchAll(/(?<![A-Za-z0-9])([A-Za-z]{1,6})[ _.\-]?\d{1,4}(?![0-9A-Za-z])/g)].map(m => m[1].toUpperCase())))]
const PP_TYPES: Record<string, string> = { fournisseur: 'FOURNISSEUR', client: 'CLIENT', partenaire: 'PARTENAIRE', prestataire: 'PRESTATAIRE', regulateur: 'ORGANISME_REGULATION', organisme: 'ORGANISME_REGULATION' }
const listSplit = (s: string) => s.split(/\r?\n|;/).map(x => x.trim()).filter(Boolean)
const numbered = (s: string) => s.split(/(?:^|\s)\d+\s*[-.)]\s+/).map(x => x.trim()).filter(Boolean)

export function buildAtelierContent(sheets: AtelierSheet[]): { content: AtelierContent; report: AtelierBuildReport } {
  const report: AtelierBuildReport = { defaulted: [], conflicts: [], notRetained: {} }
  const raw: Record<string, unknown> = { businessValues: [], supportAssets: [], fearedEvents: [], riskSources: [], stakeholders: [], strategicScenarios: [], operationalScenarios: [], securityBaseline: [] }
  const byRole = (role: AtelierRole) => sheets.filter(s => s.type === role)
  const idsOf = (role: AtelierRole) => byRole(role).flatMap(s => s.rows.map(r => cellOf(r, s.mapping.externalId)).filter(Boolean))

  /** Lignes retenues selon le mode du rôle (défaut par rôle) ; le décompte des non retenues alimente le rapport. */
  const kept = (s: AtelierSheet) => {
    const col = s.mapping.retained
    if (!col) return s.rows
    const mode = s.retainedMode ?? defaultRetainedMode(s.type)
    const rows = filterRetained(s.rows.map(r => ({ ...r, __r: cellOf(r, col) })), '__r', mode)
    const dropped = s.rows.length - rows.length
    if (dropped) report.notRetained[s.type] = (report.notRetained[s.type] ?? 0) + dropped
    return rows
  }
  const refList = (value: string, ownRole: AtelierRole | null, targetRole: AtelierRole, all: string[]) => {
    const prefixes = prefixesOf(idsOf(targetRole)).length ? prefixesOf(idsOf(targetRole)) : inferPrefixes(all)
    void ownRole
    return extractReferences(value, { prefixes }).map(r => r.ref)
  }
  const opt = <T,>(v: T | undefined | '') => (v === undefined || v === '' ? {} : v)
  void opt

  for (const s of byRole('BUSINESS_VALUES')) for (const r of kept(s)) {
    const m = s.mapping
    raw.businessValues = [...(raw.businessValues as unknown[]), {
      ...(cellOf(r, m.externalId) ? { externalId: cellOf(r, m.externalId) } : {}), title: cellOf(r, m.title), ...(cellOf(r, m.type) ? { type: cellOf(r, m.type).split('/')[0].trim() } : {}),
      ...(cellOf(r, m.description) ? { description: cellOf(r, m.description) } : {}), ...(cellOf(r, m.responsible) ? { responsible: cellOf(r, m.responsible) } : {}), ...(cellOf(r, m.justification) ? { justification: cellOf(r, m.justification) } : {}),
      needs: { availability: level(cellOf(r, m.availability)), integrity: level(cellOf(r, m.integrity)), confidentiality: level(cellOf(r, m.confidentiality)) },
    }]
  }
  for (const s of byRole('SUPPORT_ASSETS')) {
    const all = s.rows.map(r => cellOf(r, s.mapping.businessValueRefs))
    for (const r of kept(s)) raw.supportAssets = [...(raw.supportAssets as unknown[]), {
      ...(cellOf(r, s.mapping.externalId) ? { externalId: cellOf(r, s.mapping.externalId) } : {}), title: cellOf(r, s.mapping.title),
      ...(cellOf(r, s.mapping.category) ? { category: cellOf(r, s.mapping.category) } : {}), ...(cellOf(r, s.mapping.description) ? { description: cellOf(r, s.mapping.description) } : {}),
      businessValueExternalIds: refList(cellOf(r, s.mapping.businessValueRefs), 'SUPPORT_ASSETS', 'BUSINESS_VALUES', all),
    }]
  }
  for (const s of byRole('FEARED_EVENTS')) {
    const all = s.rows.map(r => cellOf(r, s.mapping.businessValueRefs))
    for (const r of kept(s)) raw.fearedEvents = [...(raw.fearedEvents as unknown[]), {
      ...(cellOf(r, s.mapping.externalId) ? { externalId: cellOf(r, s.mapping.externalId) } : {}), title: cellOf(r, s.mapping.title),
      ...(cellOf(r, s.mapping.description) ? { description: cellOf(r, s.mapping.description) } : {}), ...(cellOf(r, s.mapping.impacts) ? { impacts: cellOf(r, s.mapping.impacts) } : {}),
      gravity: level(cellOf(r, s.mapping.gravity)), businessValueExternalIds: refList(cellOf(r, s.mapping.businessValueRefs), 'FEARED_EVENTS', 'BUSINESS_VALUES', all),
    }]
  }
  for (const s of byRole('RISK_SOURCES')) {
    const m = s.mapping
    const rows = kept(s).map(r => ({ ...r, __title: cellOf(r, m.title), __ref: cellOf(r, m.externalId), __obj: cellOf(r, m.objective), __mot: cellOf(r, m.motivation), __res: cellOf(r, m.resources), __rel: cellOf(r, m.relevance), __ret: cellOf(r, m.retained), __just: cellOf(r, m.justification) }))
    for (const g of groupRows(rows, '__title', ['__mot', '__res'])) {
      if (!g.key) continue
      for (const c of g.conflicts) report.conflicts.push({ sheet: s.name, key: g.key, column: c.column, values: c.values })
      const retained = g.rows.some(r => normalizeRetained(r.__ret) === 'YES')
      const cat = suggestValueMap([g.key], 'sourceCategory')[g.key]
      if (!cat) report.defaulted.push({ sheet: s.type, field: 'category', source: g.key, value: 'AUTRE' })
      raw.riskSources = [...(raw.riskSources as unknown[]), {
        ...(g.rows[0].__ref ? { externalId: g.rows[0].__ref } : {}), title: g.key, category: cat ?? 'AUTRE',
        motivation: symbolOrLevel(g.parent.__mot ?? ''), resources: symbolOrLevel(g.parent.__res ?? ''), relevance: level(g.rows[0].__rel), retained,
        ...(g.rows.find(r => normalizeRetained(r.__ret) === 'YES' && r.__just)?.__just ? { justification: g.rows.find(r => normalizeRetained(r.__ret) === 'YES' && r.__just)!.__just } : {}),
        objectives: [...new Set(g.rows.map(r => r.__obj).filter(Boolean))],
      }]
    }
  }
  for (const s of byRole('STAKEHOLDERS')) for (const r of kept(s)) {
    const typeRaw = cellOf(r, s.mapping.type)
    raw.stakeholders = [...(raw.stakeholders as unknown[]), {
      ...(cellOf(r, s.mapping.externalId) ? { externalId: cellOf(r, s.mapping.externalId) } : {}), title: cellOf(r, s.mapping.title), type: PP_TYPES[norm(typeRaw)] ?? 'AUTRE',
      ...(cellOf(r, s.mapping.description) ? { description: cellOf(r, s.mapping.description) } : {}),
      dependency: level(cellOf(r, s.mapping.dependency)), penetration: level(cellOf(r, s.mapping.penetration)), maturity: level(cellOf(r, s.mapping.maturity)), trust: level(cellOf(r, s.mapping.trust)),
    }]
  }
  for (const s of byRole('STRATEGIC_SCENARIOS')) {
    const ppAll = s.rows.map(r => cellOf(r, s.mapping.stakeholderRefs)); const erAll = s.rows.map(r => cellOf(r, s.mapping.fearedEventRefs))
    for (const r of kept(s)) {
      const erText = cellOf(r, s.mapping.fearedEventRefs)
      const erPrefixes = prefixesOf(idsOf('FEARED_EVENTS')).length ? prefixesOf(idsOf('FEARED_EVENTS')) : inferPrefixes(erAll)
      raw.strategicScenarios = [...(raw.strategicScenarios as unknown[]), {
        ...(cellOf(r, s.mapping.externalId) ? { externalId: cellOf(r, s.mapping.externalId) } : {}), title: cellOf(r, s.mapping.title),
        ...(cellOf(r, s.mapping.riskSource) ? { riskSourceLabel: cellOf(r, s.mapping.riskSource) } : {}), ...(cellOf(r, s.mapping.objective) ? { objective: cellOf(r, s.mapping.objective) } : {}),
        ...(cellOf(r, s.mapping.description) ? { description: cellOf(r, s.mapping.description) } : {}),
        fearedEventExternalIds: extractReferencesWithLabels(erText, { prefixes: erPrefixes }).map(x => x.ref),
        stakeholderExternalIds: refList(cellOf(r, s.mapping.stakeholderRefs), 'STRATEGIC_SCENARIOS', 'STAKEHOLDERS', ppAll),
        gravity: level(cellOf(r, s.mapping.gravity)), attackPath: numbered(cellOf(r, s.mapping.attackPath)),
      }]
    }
  }
  for (const s of byRole('OPERATIONAL_SCENARIOS')) {
    const ssAll = s.rows.map(r => cellOf(r, s.mapping.strategicRef))
    for (const r of kept(s)) {
      const refs = refList(cellOf(r, s.mapping.strategicRef), 'OPERATIONAL_SCENARIOS', 'STRATEGIC_SCENARIOS', ssAll)
      raw.operationalScenarios = [...(raw.operationalScenarios as unknown[]), {
        ...(cellOf(r, s.mapping.externalId) ? { externalId: cellOf(r, s.mapping.externalId) } : {}), title: cellOf(r, s.mapping.title),
        ...(refs[0] ? { strategicScenarioExternalId: refs[0] } : {}), likelihood: level(cellOf(r, s.mapping.likelihood)),
      }]
    }
  }
  for (const s of byRole('SECURITY_BASELINE')) for (const r of kept(s)) {
    const cov = cellOf(r, s.mapping.coverage)
    raw.securityBaseline = [...(raw.securityBaseline as unknown[]), {
      title: cellOf(r, s.mapping.title), ...(cellOf(r, s.mapping.category) ? { category: cellOf(r, s.mapping.category) } : {}), ...(cellOf(r, s.mapping.subCategory) ? { subCategory: cellOf(r, s.mapping.subCategory) } : {}),
      ...(/^[0-3]$/.test(cov) ? { coverage: Number(cov) } : {}), ...(cellOf(r, s.mapping.comment) ? { comment: cellOf(r, s.mapping.comment) } : {}),
    }]
  }
  void listSplit
  // Les objets sans intitulé ne sont jamais créés ; les valeurs `undefined` sont retirées par le schéma.
  const clean = JSON.parse(JSON.stringify(raw, (_k, v) => (v === undefined ? undefined : v)))
  for (const k of Object.keys(clean)) if (Array.isArray(clean[k])) clean[k] = (clean[k] as { title?: string }[]).filter(o => o.title)
  return { content: atelierContentSchema.parse(clean), report }
}
