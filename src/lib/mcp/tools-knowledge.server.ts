// ─── Outils MCP de CONNAISSANCE (lecture seule, non spécifiques à une organisation) ───────────────────────────────────
// Donnent à l'agent des faits vérifiés et sourcés livrés avec ACRA (régimes de déclaration d'incident et délais, incidents types,
// champs DORA de l'ITS 2025/302, catalogue sectoriel) plutôt que des souvenirs. Aucun accès aux données d'une organisation.

import { CATALOGUE_REGIMES } from '@/lib/notification-regimes'
import { REGIME_INFO, regimeInfo, type InfoLocale } from '@/lib/regime-info'
import { searchIncidentTypes, INCIDENT_CHECKLIST, type IncidentLocale } from '@/lib/incident-types-catalogue'
import { DORA_STAGES, fieldsOfStage, type DoraStage } from '@/lib/incident-declaration'
import { SECTOR_CODES, CATALOGUE_PACK_VERSION, searchSectorSuggestions, type SectorCode } from '@/lib/sector-suggestions'
import { TEST_RESILIENCE_TYPES } from '@/lib/tests-resilience'
import { getT } from '@/lib/i18n'
import { toolText, type McpTool, type McpToolResult } from './protocol'
import type { McpContext } from './tools.server'

const LOCALES = ['fr', 'en', 'de', 'es', 'it'] as const
const loc = (v: unknown) => ((LOCALES as readonly string[]).includes(String(v)) ? String(v) : 'fr') as InfoLocale
const lim = (v: unknown, def: number, max: number) => { const n = typeof v === 'number' ? Math.floor(v) : NaN; return Number.isFinite(n) ? Math.min(max, Math.max(1, n)) : def }
const NOTE = 'Informations de cadrage tirées des textes publiés : à confirmer auprès de l’autorité ou du conseil juridique (ce n’est pas un avis juridique).'

export const readNotificationRegimesTool: McpTool<McpContext> = {
  name: 'read_notification_regimes',
  description:
    "Régimes de déclaration d'incident livrés (DORA, NIS2, RGPD art. 33, CRA art. 14, SEC 8-K, NYDFS 500.17, HIPAA, US bancaire fédéral, FTC Safeguards…) : " +
    "base légale, destinataire, déclencheur, délais exacts, canal, sources, et phases chiffrées. Fournir `code` pour un régime, `locale` pour la langue. Lecture seule.",
  inputSchema: { type: 'object', properties: { code: { type: 'string' }, locale: { type: 'string', enum: [...LOCALES] } }, additionalProperties: false },
  async handler(args): Promise<McpToolResult> {
    const locale = loc(args.locale)
    const wanted = typeof args.code === 'string' && args.code ? args.code : null
    const codes = [...new Set([...Object.keys(REGIME_INFO), ...CATALOGUE_REGIMES.map(r => r.code)])].filter(c => !wanted || c === wanted)
    const regimes = codes.map(code => {
      const cat = CATALOGUE_REGIMES.find(r => r.code === code)
      const info = regimeInfo(code, locale)
      return {
        code,
        ...(cat ? { declencheur: cat.declencheur, phases: cat.phases.map(p => ({ code: p.code, delai: p.delai, apres: p.apres })) } : {}),
        ...(info ?? {}),
        note: NOTE,
      }
    })
    return toolText({ count: regimes.length, regimes })
  },
}

export const readIncidentTypesTool: McpTool<McpContext> = {
  name: 'read_incident_types',
  description:
    "Incidents types (cyber : hameçonnage, rançongiciel, DDoS… ; autres risques : panne, fraude, sinistre… ; et ceux propres à un secteur) : intitulé, catégorie, " +
    "caractère TIC, données personnelles probables, régimes de notification à examiner et informations à recueillir. `query` (recherche tolérante), `sectors` (codes de secteur), `locale`, `limit`.",
  inputSchema: { type: 'object', properties: { query: { type: 'string' }, sectors: { type: 'array', items: { type: 'string' } }, locale: { type: 'string', enum: [...LOCALES] }, limit: { type: 'integer', minimum: 1, maximum: 100 } }, additionalProperties: false },
  async handler(args): Promise<McpToolResult> {
    const locale = loc(args.locale) as IncidentLocale
    const sectors = Array.isArray(args.sectors) ? args.sectors.map(String).filter(s => (SECTOR_CODES as readonly string[]).includes(s)) : undefined
    const types = searchIncidentTypes(typeof args.query === 'string' ? args.query : '', locale, sectors).slice(0, lim(args.limit, 30, 100)).map(t => ({
      key: t.key, title: t.title[locale], categorie: t.categorie, ...(t.sector ? { sector: t.sector } : {}), tic: t.tic, donneesPersonnelles: t.donnees, causeRacine: t.causeRacine,
      regimes: t.regimes, aCompleter: t.aCompleter.map(id => INCIDENT_CHECKLIST[id]?.[locale] ?? id), ...(t.itsType ? { itsType: t.itsType } : {}),
    }))
    return toolText({ count: types.length, types, note: 'Un incident type ne décrit jamais un fait ; le caractère significatif/majeur et la décision de déclarer restent ceux de l’entité.' })
  },
}

export const readDoraFieldsTool: McpTool<McpContext> = {
  name: 'read_dora_fields',
  description:
    "Champs de la déclaration d'incident majeur DORA (règlement d'exécution (UE) 2025/302, annexe II) par étape (INITIAL, INTERMEDIATE, FINAL, cumulatives) : numéro, intitulé officiel, " +
    "format, caractère obligatoire, condition et listes de valeurs admises. `stage` requis ; `mandatoryOnly` pour ne garder que les champs obligatoires.",
  inputSchema: { type: 'object', properties: { stage: { type: 'string', enum: [...DORA_STAGES] }, mandatoryOnly: { type: 'boolean' } }, required: ['stage'], additionalProperties: false },
  async handler(args): Promise<McpToolResult> {
    const stage = String(args.stage) as DoraStage
    if (!(DORA_STAGES as readonly string[]).includes(stage)) return { content: [{ type: 'text', text: 'etape_invalide' }], isError: true }
    let fields = fieldsOfStage(stage)
    if (args.mandatoryOnly === true) fields = fields.filter(f => f.mandatory !== 'COND')
    return toolText({
      stage, count: fields.length,
      fields: fields.map(f => ({ id: f.id, name: f.name, kind: f.kind, mandatory: f.mandatory, ...(f.condition ? { condition: f.condition } : {}), ...(f.options ? { options: f.options } : {}) })),
      source: 'Règlement d’exécution (UE) 2025/302, annexe II (glossaire de données) ; délais : règlement délégué (UE) 2025/301 art. 5. À confirmer sur EUR-Lex.',
    })
  },
}

export const readCatalogueTool: McpTool<McpContext> = {
  name: 'read_catalogue',
  description:
    "Catalogue sectoriel ACRA (processus, risques, contrôles-types, KRI, missions d'audit, plans de test de résilience) : suggestions à qualifier, jamais des éléments évalués. " +
    "`sector` (code, ex. SANTE), `kind` (PROCESS|RISK|CONTROL|KRI|AUDIT|RESILIENCE_TEST), `query`, `locale`, `limit`. Contenu à relire par un expert du secteur.",
  inputSchema: { type: 'object', properties: { sector: { type: 'string' }, kind: { type: 'string', enum: ['PROCESS', 'RISK', 'CONTROL', 'KRI', 'AUDIT', 'RESILIENCE_TEST'] }, query: { type: 'string' }, locale: { type: 'string', enum: [...LOCALES] }, limit: { type: 'integer', minimum: 1, maximum: 100 } }, additionalProperties: false },
  async handler(args): Promise<McpToolResult> {
    const locale = loc(args.locale)
    const sector = typeof args.sector === 'string' && args.sector ? args.sector : null
    if (sector && !(SECTOR_CODES as readonly string[]).includes(sector)) return toolText({ version: CATALOGUE_PACK_VERSION, count: 0, items: [] })
    const kind = typeof args.kind === 'string' ? args.kind : null
    const items = searchSectorSuggestions(sector as SectorCode | null, locale, typeof args.query === 'string' ? args.query : '')
      .filter(i => !kind || i.kind === kind).slice(0, lim(args.limit, 30, 100))
      .map(i => ({ key: i.key, kind: i.kind, sector: i.sector, title: i.title, ...(i.periodicite ? { periodicite: i.periodicite } : {}), ...(i.controlType ? { controlType: i.controlType } : {}), ...(i.unite ? { unite: i.unite } : {}), ...(i.points ? { points: i.points } : {}), ...(i.references?.length ? { references: i.references } : {}), ...(i.riskKeys?.length ? { riskKeys: i.riskKeys } : {}) }))
    return toolText({ version: CATALOGUE_PACK_VERSION, count: items.length, items })
  },
}

export const readResilienceTestsTool: McpTool<McpContext> = {
  name: 'read_resilience_tests',
  description:
    "Programme de tests de résilience opérationnelle numérique DORA : les douze types de tests de l'article 25 § 1 (libellés officiels dans la langue demandée) et, à part, " +
    "les règles essentielles du test de pénétration fondé sur la menace (TLPT, article 26). `locale` facultatif. Lecture seule.",
  inputSchema: { type: 'object', properties: { locale: { type: 'string', enum: [...LOCALES] } }, additionalProperties: false },
  async handler(args): Promise<McpToolResult> {
    const locale = loc(args.locale)
    const labels = getT(locale).testsResilience.types as Record<string, string>
    return toolText({
      art25: TEST_RESILIENCE_TYPES.filter(c => c !== 'TLPT').map(code => ({ code, label: labels[code] ?? code })),
      tlpt: {
        article: 'Règlement (UE) 2022/2554, art. 26 (testeurs : art. 27)',
        frequence: 'au moins tous les 3 ans pour les entités financières concernées (autres que les microentreprises) ; l’autorité compétente peut demander de la réduire ou de l’augmenter',
        entite: 'organiser et financer le test, désigner des testeurs conformes à l’art. 27 (externes ; testeurs internes seulement dans les conditions prévues, avec recours à des testeurs externes tous les trois tests), couvrir les fonctions critiques ou importantes',
        autorite: 'identifier les entités tenues de réaliser un TLPT, valider le périmètre, délivrer l’attestation de réalisation et pouvoir ajuster la fréquence',
        note: 'Cadrage à confirmer sur EUR-Lex (art. 26-27 et règlement délégué sur les TLPT) ; ce n’est pas un avis juridique.',
      },
      note: 'Types de l’article 25 § 1 : à confirmer sur EUR-Lex ; le choix et le calendrier des tests restent ceux de l’entité (approche fondée sur les risques).',
    })
  },
}

export function buildKnowledgeTools(): McpTool<McpContext>[] { return [readNotificationRegimesTool, readIncidentTypesTool, readDoraFieldsTool, readCatalogueTool, readResilienceTestsTool] }
