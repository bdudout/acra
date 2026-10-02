// ─── Déclaration d'un incident à une autorité : champs, compléments et fichiers JSON / Excel (PUR) ─────────────────────────
// DORA : les champs reprennent la numérotation, les intitulés (anglais, langue de référence des modèles), les types, les listes de
// valeurs admises et le caractère obligatoire de l'annexe II (glossaire de données) du règlement d'exécution (UE) 2025/302
// (formulaires et modèles de notification des incidents majeurs liés aux TIC), d'après le texte publié ; à confirmer sur EUR-Lex.
// ACRA PRÉREMPLIT ce qu'il sait (incident, critères de classification, chronologie, pertes) et laisse l'entité compléter le reste ;
// une valeur saisie l'emporte toujours sur la déduction. Le canal, le schéma et le format de dépôt sont fixés par l'autorité
// compétente nationale (en France : ACPR, OneGate, rapport DORA_IR au format JSON validé par le schéma ESAs/ACPR « DORA_IR_Schema »,
// que ce module ne reproduit pas) : les fichiers JSON et Excel sont une AIDE À LA DÉCLARATION (pivot structuré), ils ne valent pas
// dépôt. Rien n'est transmis par ACRA.

import { criteresDeclenches, type DoraCritere, type DoraCriteres } from './dora'
import { incidentTypeByKey } from './incident-types-catalogue'

export const DORA_STAGES = ['INITIAL', 'INTERMEDIATE', 'FINAL'] as const
export type DoraStage = (typeof DORA_STAGES)[number]
type FieldStage = 'GENERAL' | DoraStage
/** Type de donnée du glossaire : texte, entier, pourcentage, date-heure UTC, booléen, choix unique ou multiple, durée JJ:HH:MM, montant en milliers, pays ISO 3166 alpha-2, devise ISO 4217, code LEI. */
export type FieldKind = 'text' | 'integer' | 'percent' | 'datetime' | 'bool' | 'choice' | 'multi' | 'duration' | 'amount' | 'country' | 'currency' | 'lei'
/** Obligatoire : à toutes les étapes (ALL), dès le rapport intermédiaire (FROM_INTERMEDIATE), au rapport final seulement (FINAL) ou sous condition (COND). */
export type Mandatory = 'ALL' | 'FROM_INTERMEDIATE' | 'FINAL' | 'COND'
export interface DoraItsField {
  id: string; stage: FieldStage; name: string; kind: FieldKind; mandatory: Mandatory; editable: boolean
  /** Valeurs admises (anglais, telles que publiées) ; pour 4.2 / 4.3 : union des groupes. */
  options?: string[]
  /** 4.2 : options par valeur de 4.1 ; 4.3 : options par valeur de 4.2. */
  groups?: Record<string, string[]>
  /** Condition de remplissage d'un champ conditionnel (anglais, d'après le glossaire). */
  condition?: string
}

interface FOpts { options?: string[]; groups?: Record<string, string[]>; condition?: string; editable?: boolean }
const f = (id: string, stage: FieldStage, name: string, kind: FieldKind, mandatory: Mandatory, o: FOpts = {}): DoraItsField => ({
  id, stage, name, kind, mandatory, editable: o.editable ?? true,
  ...(o.options ? { options: o.options } : o.groups ? { options: [...new Set(Object.values(o.groups).flat())] } : {}),
  ...(o.groups ? { groups: o.groups } : {}), ...(o.condition ? { condition: o.condition } : {}),
})

const ENTITY_TYPES = ['credit institution', 'payment institution', 'exempted payment institution', 'account information service provider', 'electronic money institution', 'exempted electronic money institution', 'investment firm', 'crypto-asset service provider', 'issuer of asset-referenced tokens', 'central securities depository', 'central counterparty', 'trading venue', 'trade repository', 'manager of alternative investment fund', 'management company', 'data reporting service provider', 'insurance and reinsurance undertaking', 'insurance intermediary, reinsurance intermediary and ancillary insurance intermediary', 'institution for occupational retirement provision', 'credit rating agency', 'administrator of critical benchmarks', 'crowdfunding service provider', 'securitisation repository']
export const CRITERIA_OPTIONS = ['clients, financial counterparts and transactions affected', 'reputational impact', 'duration and service downtime', 'geographical spread', 'data losses', 'critical services affected', 'economic impact']
const YES_NO_NA = ['Yes', 'No', 'Information not available']
const ROOT_HIGH = ['malicious actions', 'process failure', 'system failure/malfunction', 'human error', 'external event']
const ROOT_DETAIL: Record<string, string[]> = {
  'malicious actions': ['deliberate internal actions', 'deliberate physical damage/manipulation/theft', 'fraudulent actions'],
  'process failure': ['insufficient monitoring or failure of monitoring and control', 'insufficient/unclear roles and responsibilities', 'ICT risk management process failure', 'insufficient or failure of ICT operations and ICT security operations', 'insufficient or failure of ICT project management', 'inadequate internal policies, procedures and documentation', 'inadequate ICT systems acquisition, development, and maintenance', 'other (please specify)'],
  'system failure/malfunction': ['hardware capacity and performance', 'hardware maintenance', 'hardware obsolescence/ageing', 'software compatibility/configuration', 'software performance', 'network configuration', 'physical damage', 'other (please specify)'],
  'human error': ['omission (unintentional)', 'mistake', 'skills & knowledge', 'inadequate human resources', 'miscommunication', 'other (please specify)'],
  'external event': ['natural disasters/force majeure', 'third-party failures', 'other (please specify)'],
}
const ROOT_ADDITIONAL: Record<string, string[]> = {
  'insufficient monitoring or failure of monitoring and control': ['monitoring of policy adherence', 'monitoring of third-party service providers', 'monitoring and verification of remediation of vulnerabilities', 'identity and access management', 'encryption and cryptography', 'logging'],
  'ICT risk management process failure': ['failure in specifying accurate risk tolerance levels', 'insufficient vulnerability and threat assessments', 'inadequate risk treatment measures', 'poor management of residual ICT risks'],
  'insufficient or failure of ICT operations and ICT security operations': ['vulnerability and patch management', 'change management', 'capacity and performance management', 'ICT asset management and information classification', 'backup and restore', 'error handling'],
  'inadequate ICT systems acquisition, development, and maintenance': ['inadequate ICT systems acquisition, development, and maintenance', 'insufficient software testing or failure of software testing'],
}
export const INCIDENT_TYPE_OPTIONS = ['Cybersecurity-related', 'Process failure', 'System failure', 'External event', 'Payment-related', 'Other (please specify)']
export const THREAT_OPTIONS = ['Social engineering (including phishing)', '(D)DoS', 'Identity theft', 'Data encryption for impact, including ransomware', 'Resource hijacking', 'Data exfiltration and manipulation, excluding identity theft', 'Data destruction', 'Defacement', 'Supply-chain attack', 'Other (please specify)']

/** Annexe II du règlement d'exécution (UE) 2025/302 — glossaire de données (numérotation de l'annexe). */
export const DORA_ITS_FIELDS: DoraItsField[] = [
  f('1.1', 'GENERAL', 'Type of submission', 'choice', 'ALL', { options: ['initial notification', 'intermediate report', 'final report', 'major incident reclassified as non-major'], editable: false }),
  f('1.2', 'GENERAL', 'Name of the entity submitting the report', 'text', 'ALL'),
  f('1.3', 'GENERAL', 'Identification code of the entity submitting the report', 'lei', 'ALL'),
  f('1.4', 'GENERAL', 'Type of financial entity affected', 'multi', 'ALL', { options: ENTITY_TYPES }),
  f('1.5', 'GENERAL', 'Name of the financial entity affected', 'text', 'COND', { condition: 'if the entity differs from the submitter or for aggregated reporting' }),
  f('1.6', 'GENERAL', 'LEI code of the financial entity affected', 'lei', 'COND', { condition: 'if the entity differs from the submitter or for aggregated reporting' }),
  f('1.7', 'GENERAL', 'Primary contact person name', 'text', 'ALL'), f('1.8', 'GENERAL', 'Primary contact person email', 'text', 'ALL'), f('1.9', 'GENERAL', 'Primary contact person telephone', 'text', 'ALL'),
  f('1.10', 'GENERAL', 'Second contact person name', 'text', 'ALL'), f('1.11', 'GENERAL', 'Second contact person email', 'text', 'ALL'), f('1.12', 'GENERAL', 'Second contact person telephone', 'text', 'ALL'),
  f('1.13', 'GENERAL', 'Name of the ultimate parent undertaking', 'text', 'COND', { condition: 'if the financial entity belongs to a group' }),
  f('1.14', 'GENERAL', 'LEI code of the ultimate parent undertaking', 'lei', 'COND', { condition: 'if the financial entity belongs to a group' }),
  f('1.15', 'GENERAL', 'Reporting currency', 'currency', 'ALL', { editable: false }),
  f('2.1', 'INITIAL', 'Incident reference code assigned by the financial entity', 'text', 'ALL', { editable: false }),
  f('2.2', 'INITIAL', 'Date and time of detection of the major ICT-related incident', 'datetime', 'ALL', { editable: false }),
  f('2.3', 'INITIAL', 'Date and time of classification of the ICT-related incident as major', 'datetime', 'ALL', { editable: false }),
  f('2.4', 'INITIAL', 'Description of the major ICT-related incident', 'text', 'ALL'),
  f('2.5', 'INITIAL', 'Classification criteria that triggered the incident report', 'multi', 'ALL', { options: CRITERIA_OPTIONS }),
  f('2.6', 'INITIAL', "Materiality thresholds for the classification criterion 'Geographical spread'", 'country', 'COND', { condition: "if the 'Geographical spread' threshold is met (ISO 3166 alpha-2 codes, home country excluded)" }),
  f('2.7', 'INITIAL', 'Discovery of the major ICT-related incident', 'choice', 'ALL', { options: ['IT Security', 'staff', 'internal audit', 'external audit', 'clients', 'financial counterparts', 'third-party provider', 'attacker', 'monitoring systems', 'authority/agency/law enforcement body', 'other'] }),
  f('2.8', 'INITIAL', 'Indication whether the major ICT-related incident originates from a third-party provider or another financial entity', 'text', 'COND', { condition: 'if the incident originates from a third-party provider or another financial entity (format: legal name; LEI or EUID code; LEI or EUID; additional information)' }),
  f('2.9', 'INITIAL', 'Activation of business continuity plan, if activated', 'bool', 'ALL'),
  f('2.10', 'INITIAL', 'Other relevant information', 'text', 'COND', { condition: 'if there is additional information, or for a reclassification as non-major' }),
  f('3.1', 'INTERMEDIATE', 'Incident reference code provided by the competent authority', 'text', 'COND', { condition: 'if provided by the competent authority' }),
  f('3.2', 'INTERMEDIATE', 'Date and time of occurrence of the major ICT-related incident', 'datetime', 'FROM_INTERMEDIATE'),
  f('3.3', 'INTERMEDIATE', 'Date and time when services, activities or operations have been recovered', 'datetime', 'COND', { condition: "if 'Service downtime' (3.16) is populated" }),
  f('3.4', 'INTERMEDIATE', 'Number of clients affected', 'integer', 'FROM_INTERMEDIATE'), f('3.5', 'INTERMEDIATE', 'Percentage of clients affected', 'percent', 'FROM_INTERMEDIATE'),
  f('3.6', 'INTERMEDIATE', 'Number of financial counterparts affected', 'integer', 'FROM_INTERMEDIATE'), f('3.7', 'INTERMEDIATE', 'Percentage of financial counterparts affected', 'percent', 'FROM_INTERMEDIATE'),
  f('3.8', 'INTERMEDIATE', 'Impact on relevant clients or financial counterparts', 'bool', 'COND', { condition: "if the 'Relevance' threshold is met" }),
  f('3.9', 'INTERMEDIATE', 'Number of affected transactions', 'integer', 'COND', { condition: 'if transactions are affected' }), f('3.10', 'INTERMEDIATE', 'Percentage of affected transactions', 'percent', 'COND', { condition: 'if transactions are affected' }),
  f('3.11', 'INTERMEDIATE', 'Value of affected transactions', 'amount', 'COND', { condition: 'if transactions are affected (thousands of units, reporting currency)' }),
  f('3.12', 'INTERMEDIATE', 'Information on whether the numbers are actual or estimates, or whether there has not been any impact', 'multi', 'FROM_INTERMEDIATE', { options: ['actual figures for clients affected', 'actual figures for financial counterparts affected', 'actual figures for transactions affected', 'estimates for clients affected', 'estimates for financial counterparts affected', 'estimates for transactions affected', 'no impact on clients', 'no impact on financial counterparts', 'no impact on transactions'] }),
  f('3.13', 'INTERMEDIATE', 'Reputational impact', 'multi', 'COND', { condition: "if the 'Reputational impact' criterion is met", options: ['the major ICT-related incident has been reflected in the media', 'the major ICT-related incident has resulted in repetitive complaints from different clients or financial counterparts on client-facing services or critical business relationships', 'the financial entity will not be able to or is likely not to be able to meet regulatory requirements as a result of the major ICT-related incident', 'the financial entity will or is likely to lose clients or financial counterparts with a material impact on its business as a result of the major ICT-related incident'] }),
  f('3.14', 'INTERMEDIATE', 'Contextual information about the reputational impact', 'text', 'COND', { condition: "if the 'Reputational impact' criterion is met" }),
  f('3.15', 'INTERMEDIATE', 'Duration of the major ICT-related incident', 'duration', 'FROM_INTERMEDIATE'),
  f('3.16', 'INTERMEDIATE', 'Service downtime', 'duration', 'COND', { condition: 'if the incident caused service downtime' }),
  f('3.17', 'INTERMEDIATE', 'Information on whether the numbers for duration and service downtime are actual or estimates', 'choice', 'COND', { condition: "if the 'Duration and service downtime' criterion is met", options: ['Actual figures', 'Estimates', 'Actual figures and estimates', 'No information available'] }),
  f('3.18', 'INTERMEDIATE', 'Types of impact in the Member States', 'multi', 'COND', { condition: "if the 'Geographical spread' threshold is met", options: ['clients', 'financial counterparts', 'branch of the financial entity', 'financial entities within the group carrying out activities in the respective Member State', 'financial market infrastructure', 'third-party providers that may be common to other financial entities'] }),
  f('3.19', 'INTERMEDIATE', 'Description of how the major ICT-related incident has an impact in other Member States', 'text', 'COND', { condition: "if the 'Geographical spread' threshold is met" }),
  f('3.20', 'INTERMEDIATE', "Materiality thresholds for the classification criterion 'Data losses'", 'multi', 'COND', { condition: "if the 'Data losses' criterion is met", options: ['availability', 'authenticity', 'integrity', 'confidentiality'] }),
  f('3.21', 'INTERMEDIATE', 'Description of the data losses', 'text', 'COND', { condition: "if the 'Data losses' criterion is met" }),
  f('3.22', 'INTERMEDIATE', "Classification criterion 'Critical services affected'", 'text', 'FROM_INTERMEDIATE'),
  f('3.23', 'INTERMEDIATE', 'Type of the major ICT-related incident', 'multi', 'FROM_INTERMEDIATE', { options: INCIDENT_TYPE_OPTIONS }),
  f('3.24', 'INTERMEDIATE', 'Other types of incidents', 'text', 'COND', { condition: "if 'Other' is selected in 3.23" }),
  f('3.25', 'INTERMEDIATE', 'Threats and techniques used by the threat actor', 'multi', 'COND', { condition: "if 'Cybersecurity-related' is selected in 3.23", options: THREAT_OPTIONS }),
  f('3.26', 'INTERMEDIATE', 'Other types of techniques', 'text', 'COND', { condition: "if 'Other' is selected in 3.25" }),
  f('3.27', 'INTERMEDIATE', 'Information about affected functional areas and business processes', 'text', 'FROM_INTERMEDIATE'),
  f('3.28', 'INTERMEDIATE', 'Affected infrastructure components supporting business processes', 'choice', 'FROM_INTERMEDIATE', { options: YES_NO_NA }),
  f('3.29', 'INTERMEDIATE', 'Information about affected infrastructure components supporting business processes', 'text', 'COND', { condition: 'if infrastructure components were affected' }),
  f('3.30', 'INTERMEDIATE', 'Impact on the financial interest of clients', 'choice', 'FROM_INTERMEDIATE', { options: YES_NO_NA }),
  f('3.31', 'INTERMEDIATE', 'Reporting to other authorities', 'multi', 'FROM_INTERMEDIATE', { options: ['Police/Law Enforcement', 'CSIRT', 'Data Protection Authority', 'National Cybersecurity Agency', 'None', 'Other (please specify)'] }),
  f('3.32', 'INTERMEDIATE', "Specification of 'other' authorities", 'text', 'COND', { condition: "if 'Other' authorities were informed" }),
  f('3.33', 'INTERMEDIATE', 'Temporary actions/measures taken or planned to be taken to recover from the incident', 'bool', 'FROM_INTERMEDIATE'),
  f('3.34', 'INTERMEDIATE', 'Description of any temporary actions and measures taken or planned to be taken to recover from the incident', 'text', 'COND', { condition: 'if temporary actions were taken or planned (3.33)' }),
  f('3.35', 'INTERMEDIATE', 'Indicators of compromise', 'text', 'COND', { condition: "if 'Cybersecurity-related' is selected in 3.23 (entities within NIS2 scope)" }),
  f('4.1', 'FINAL', 'High-level classification of root causes of the incident', 'multi', 'FINAL', { options: ROOT_HIGH }),
  f('4.2', 'FINAL', 'Detailed classification of root causes of the incident', 'multi', 'FINAL', { groups: ROOT_DETAIL }),
  f('4.3', 'FINAL', 'Additional classification of root causes of the incident', 'multi', 'COND', { condition: 'if the categories selected in 4.2 require further granularity', groups: ROOT_ADDITIONAL }),
  f('4.4', 'FINAL', 'Other types of root cause types', 'text', 'COND', { condition: "if 'other' is selected in 4.2" }),
  f('4.5', 'FINAL', 'Information about the root causes of the incident', 'text', 'FINAL'), f('4.6', 'FINAL', 'Incident resolution summary', 'text', 'FINAL'),
  f('4.7', 'FINAL', 'Date and time when the incident root cause was addressed', 'datetime', 'FINAL'), f('4.8', 'FINAL', 'Date and time when the incident was resolved', 'datetime', 'FINAL'),
  f('4.9', 'FINAL', 'Information if the permanent resolution date of the incident differs from the initially planned implementation date', 'text', 'COND', { condition: 'if applicable' }),
  f('4.10', 'FINAL', 'Assessment of risk to critical functions for resolution purposes', 'text', 'COND', { condition: 'if the incident poses a risk to critical functions (Directive 2014/59/EU)' }),
  f('4.11', 'FINAL', 'Information relevant for resolution authorities', 'text', 'COND', { condition: 'if the incident has affected resolvability' }),
  f('4.12', 'FINAL', "Materiality threshold for the classification criterion 'Economic impact'", 'text', 'FINAL'),
  f('4.13', 'FINAL', 'Amount of gross direct and indirect costs and losses', 'amount', 'FINAL'), f('4.14', 'FINAL', 'Amount of financial recoveries', 'amount', 'FINAL'),
  f('4.15', 'FINAL', 'Information on whether the non-major incidents have been recurring', 'text', 'COND', { condition: 'if the major incident comprises several recurring non-major incidents' }),
  f('4.16', 'FINAL', 'Date and time of occurrence of recurring incidents', 'datetime', 'COND', { condition: 'for recurring incidents' }),
]
const BY_ID = new Map(DORA_ITS_FIELDS.map(x => [x.id, x]))
const MAX_TEXT = 2000

export type DeclarationValue = string | number | boolean | string[]
export type Declaration = Record<string, DeclarationValue>

/** Date-heure UTC au format du glossaire (ISO 8601, sans millisecondes) ; null si invalide. */
export function itsDatetime(v: unknown): string | null {
  // Une date-heure sans fuseau (« 2026-10-05 07:00 ») est lue en UTC : déterministe, jamais l'heure du serveur.
  const raw = typeof v === 'string' ? v.trim() : v
  const d = v instanceof Date ? v : new Date(typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(raw) ? `${raw.replace(' ', 'T')}${raw.length === 16 ? ':00' : ''}Z` : String(raw ?? ''))
  return Number.isNaN(d.getTime()) ? null : `${d.toISOString().slice(0, 19)}Z`
}
/** Durée « JJ:HH:MM » (jours, heures 00-23, minutes 00-59) depuis un nombre de minutes. */
export function itsDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(m / 1440))}:${pad(Math.floor((m % 1440) / 60))}:${pad(m % 60)}`
}
const DURATION_RE = /^\d{1,3}:([01]\d|2[0-3]):[0-5]\d$/

function cleanValue(field: DoraItsField, raw: unknown): DeclarationValue | undefined {
  switch (field.kind) {
    case 'integer': { const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim()); return String(raw ?? '').trim() !== '' && Number.isInteger(n) && n >= 0 ? n : undefined }
    case 'percent': { const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(',', '.').trim()); return String(raw ?? '').trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 10) / 10 : undefined }
    case 'amount': { const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(',', '.').trim()); return String(raw ?? '').trim() !== '' && Number.isFinite(n) && n >= 0 ? n : undefined }
    case 'bool': return typeof raw === 'boolean' ? raw : raw === 'true' ? true : raw === 'false' ? false : undefined
    case 'datetime': return String(raw ?? '').trim() ? itsDatetime(raw) ?? undefined : undefined
    case 'duration': { const t = String(raw ?? '').trim(); return DURATION_RE.test(t) ? t : undefined }
    case 'lei': { const t = String(raw ?? '').trim().toUpperCase(); return /^[A-Z0-9]{20}$/.test(t) ? t : undefined }
    case 'country': { const list = (Array.isArray(raw) ? raw : String(raw ?? '').split(/[;, \n]+/)).map(x => String(x).trim().toUpperCase()).filter(x => /^[A-Z]{2}$/.test(x)); return list.length ? [...new Set(list)].slice(0, 40) : undefined }
    case 'choice': { const t = String(raw ?? '').trim(); return field.options?.includes(t) ? t : undefined }
    case 'multi': { const list = (Array.isArray(raw) ? raw : String(raw ?? '').split(/;\s*/)).map(x => String(x).trim()).filter(x => field.options?.includes(x)); return list.length ? [...new Set(list)] : undefined }
    case 'currency': { const t = String(raw ?? '').trim().toUpperCase(); return /^[A-Z]{3}$/.test(t) ? t : undefined }
    default: { const t = String(raw ?? '').trim().slice(0, MAX_TEXT); return t || undefined }
  }
}

// ─── RGPD art. 33 § 3 : contenu de la notification de violation à l'autorité de contrôle (CNIL en France) ────────────────
// Rubriques libres complétées par l'entité (rien n'est présumé) ; stockées avec la déclaration sous des clés `rgpd.*`.
export interface RgpdField { id: string; key: string; kind: 'text' | 'integer'; art: string }
export const RGPD_FIELDS: RgpdField[] = [
  { id: 'rgpd.nature', key: 'nature', kind: 'text', art: '33(3)(a)' },
  { id: 'rgpd.categoriesPersonnes', key: 'categoriesPersonnes', kind: 'text', art: '33(3)(a)' },
  { id: 'rgpd.nbPersonnes', key: 'nbPersonnes', kind: 'integer', art: '33(3)(a)' },
  { id: 'rgpd.categoriesDonnees', key: 'categoriesDonnees', kind: 'text', art: '33(3)(a)' },
  { id: 'rgpd.nbEnregistrements', key: 'nbEnregistrements', kind: 'integer', art: '33(3)(a)' },
  { id: 'rgpd.dpo', key: 'dpo', kind: 'text', art: '33(3)(b)' },
  { id: 'rgpd.consequences', key: 'consequences', kind: 'text', art: '33(3)(c)' },
  { id: 'rgpd.mesures', key: 'mesures', kind: 'text', art: '33(3)(d)' },
  { id: 'rgpd.retardMotif', key: 'retardMotif', kind: 'text', art: '33(1)' },
]
const RGPD_BY_ID = new Map(RGPD_FIELDS.map(f => [f.id, f]))
const RGPD_MAX_TEXT = 2000

/** Rubriques RGPD saisies : texte borné, entier positif ; clés inconnues écartées. */
export function cleanRgpd(input: unknown): Declaration {
  const out: Declaration = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out
  for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
    const f = RGPD_BY_ID.get(id)
    if (!f) continue
    if (f.kind === 'integer') { const n = Math.floor(Number(raw)); if (Number.isFinite(n) && n >= 0 && raw !== '' && raw != null) out[id] = n }
    else { const t = String(raw ?? '').trim().slice(0, RGPD_MAX_TEXT); if (t) out[id] = t }
  }
  return out
}

/** Compléments saisis : seuls les champs ITS éditables sont gardés ; chaque valeur est contrôlée selon le type et la liste de valeurs admises du glossaire. */
export function cleanDeclaration(input: unknown): Declaration {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out: Declaration = { ...cleanRgpd(input) }
  for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
    const field = BY_ID.get(id)
    if (!field || !field.editable) continue
    const v = cleanValue(field, raw)
    if (v !== undefined) out[id] = v
  }
  return out
}

export interface DeclarationIncident {
  id: string; intitule: string; description?: string | null
  dateSurvenance?: Date | null; dateDetection?: Date | null; doraClasseMajeurLe?: Date | null
  doraCriteres?: DoraCriteres | null
  montantBrut?: number | null; recuperations?: number | null
  clotureLe?: Date | null; clotureCommentaire?: string | null
  causeRacine?: string | null; causeDetail?: string | null; typeEvenement?: string | null; catalogueKey?: string | null; statut?: string
}
export interface DeclarationContext { organisationNom: string; devise: string; now: Date }

/** Critères de classification (DORA art. 18) → valeurs du champ 2.5 (« clients, contreparties et transactions » regroupés). */
const CRITERE_VALUE: Record<DoraCritere, string> = {
  clients: CRITERIA_OPTIONS[0], transactions: CRITERIA_OPTIONS[0], reputation: CRITERIA_OPTIONS[1],
  duree: CRITERIA_OPTIONS[2], geo: CRITERIA_OPTIONS[3], donnees: CRITERIA_OPTIONS[4], serviceCritique: CRITERIA_OPTIONS[5], economique: CRITERIA_OPTIONS[6],
}
const iso = (d?: Date | null) => (d && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined)
/** Montants en MILLIERS d'unités (ITS : précision minimale équivalente aux milliers ; instruction opérationnelle des AES). */
const milliers = (v?: number | null) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) / 1000 : undefined)

const STAGE_LABEL: Record<DoraStage, { submissionType: string; field11: string }> = {
  INITIAL: { submissionType: 'initial_notification', field11: 'initial notification' },
  INTERMEDIATE: { submissionType: 'intermediate_report', field11: 'intermediate report' },
  FINAL: { submissionType: 'final_report', field11: 'final report' },
}
/** Champs d'une étape : l'étape suivante REPREND les champs des précédentes (rapport intermédiaire = 1, 2 et 3 ; final = 1 à 4). */
const STAGE_RANK: Record<FieldStage, number> = { GENERAL: 0, INITIAL: 1, INTERMEDIATE: 2, FINAL: 3 }
export const fieldsOfStage = (stage: DoraStage): DoraItsField[] => DORA_ITS_FIELDS.filter(x => x.stage === 'GENERAL' || STAGE_RANK[x.stage] <= STAGE_RANK[stage])
/** Un champ est obligatoire à cette étape ? (les conditionnels sont à examiner, jamais exigés d'office) */
export function isMandatoryAt(field: DoraItsField, stage: DoraStage): boolean {
  return field.mandatory === 'ALL' || (field.mandatory === 'FROM_INTERMEDIATE' && stage !== 'INITIAL') || (field.mandatory === 'FINAL' && stage === 'FINAL')
}

export interface DoraReportJson {
  schema: 'acra.dora-incident-report/1'; source: string; notice: string; generatedAt: string
  submissionType: string; stage: DoraStage
  fields: Record<string, DeclarationValue>
  /** Champs OBLIGATOIRES à cette étape sans valeur. */
  missing: string[]
  /** Champs CONDITIONNELS sans valeur : à renseigner si la condition du glossaire s'applique. */
  toCheck: string[]
  /** Indices ACRA non reportés tels quels (choix à faire dans les listes de l'ITS). */
  hints: { rootCause?: string; eventType?: string }
}

/** Valeurs déduites de l'incident (jamais inventées) : critères de classification, chronologie, pertes, durées, type d'incident type. */
export function deriveDeclaration(inc: DeclarationIncident, ctx: DeclarationContext): Declaration {
  const c = inc.doraCriteres ?? {}
  const d: Declaration = {}
  const set = (id: string, v: DeclarationValue | undefined) => { if (v !== undefined && v !== '') d[id] = v }
  set('1.2', ctx.organisationNom); set('1.5', ctx.organisationNom); set('1.15', ctx.devise)
  set('2.1', `ACRA-${inc.id}`); set('2.2', inc.dateDetection ? itsDatetime(inc.dateDetection) ?? undefined : undefined); set('2.3', inc.doraClasseMajeurLe ? itsDatetime(inc.doraClasseMajeurLe) ?? undefined : undefined)
  set('2.4', [inc.intitule, inc.description].filter(Boolean).join(' — '))
  const criteres = [...new Set(criteresDeclenches(c).map(x => CRITERE_VALUE[x]))]
  if (criteres.length) set('2.5', criteres)
  set('3.2', inc.dateSurvenance ? itsDatetime(inc.dateSurvenance) ?? undefined : undefined)
  if (typeof c.clientsAffectes === 'number') set('3.4', Math.round(c.clientsAffectes))
  if (typeof c.transactionsAffectees === 'number') set('3.9', Math.round(c.transactionsAffectees))
  if (typeof c.dureeIndispoMinutes === 'number') set('3.16', itsDuration(c.dureeIndispoMinutes))
  if (inc.dateSurvenance && inc.clotureLe && inc.clotureLe.getTime() >= inc.dateSurvenance.getTime()) set('3.15', itsDuration((inc.clotureLe.getTime() - inc.dateSurvenance.getTime()) / 60000))
  const t = incidentTypeByKey(inc.catalogueKey)
  if (t?.itsType) set('3.23', t.itsType)
  if (t?.itsThreats?.length) set('3.25', t.itsThreats)
  set('4.5', inc.causeDetail ?? undefined); set('4.6', inc.clotureCommentaire ?? undefined); set('4.8', inc.clotureLe ? itsDatetime(inc.clotureLe) ?? undefined : undefined)
  set('4.13', milliers(inc.montantBrut)); set('4.14', milliers(inc.recuperations))
  return d
}

/** Fichier JSON d'une étape (initiale / intermédiaire / finale) : champs généraux + champs des étapes précédentes et de celle-ci, valeurs saisies prioritaires. */
export function buildDoraReportJson(inc: DeclarationIncident, stage: DoraStage, declaration: Declaration, ctx: DeclarationContext): DoraReportJson {
  const base: Declaration = { ...deriveDeclaration(inc, ctx), ...cleanDeclaration(declaration) }
  base['1.1'] = STAGE_LABEL[stage].field11
  const fields: Record<string, DeclarationValue> = {}
  const missing: string[] = []; const toCheck: string[] = []
  for (const field of fieldsOfStage(stage)) {
    const v = base[field.id]
    if (v !== undefined) fields[field.id] = v
    else if (isMandatoryAt(field, stage)) missing.push(field.id)
    else toCheck.push(field.id)
  }
  return {
    schema: 'acra.dora-incident-report/1', generatedAt: ctx.now.toISOString(),
    source: 'Règlement d’exécution (UE) 2025/302 de la Commission, annexe II (glossaire de données) ; règlement délégué (UE) 2025/301 (contenu et délais) ; DORA — Règlement (UE) 2022/2554, art. 19',
    notice: 'Aide à la déclaration : le canal, le schéma et le format de dépôt sont fixés par l’autorité compétente (competent authority) — en France l’ACPR (OneGate, rapport DORA_IR, JSON validé par le schéma officiel) ; ce fichier n’a pas été transmis et n’est pas au format de dépôt. Vérifier chaque champ avant dépôt.',
    submissionType: STAGE_LABEL[stage].submissionType, stage, fields, missing, toCheck,
    hints: { ...(inc.causeRacine ? { rootCause: inc.causeRacine } : {}), ...(inc.typeEvenement ? { eventType: inc.typeEvenement } : {}) },
  }
}

export interface DoraFieldRow { id: string; name: string; kind: FieldKind; mandatory: string; condition?: string; value: DeclarationValue | undefined; status: 'FILLED' | 'MISSING' | 'TO_CHECK'; allowed?: string[] }

/** Lignes du tableau d'une étape (pour l'export Excel) : champ, type, caractère obligatoire, valeur, statut, valeurs admises. */
export function doraFieldRows(inc: DeclarationIncident, stage: DoraStage, declaration: Declaration, ctx: DeclarationContext): DoraFieldRow[] {
  const json = buildDoraReportJson(inc, stage, declaration, ctx)
  return fieldsOfStage(stage).map(field => {
    const value = json.fields[field.id]
    const mandatory = field.mandatory === 'ALL' ? 'all' : field.mandatory === 'FROM_INTERMEDIATE' ? 'intermediate+' : field.mandatory === 'FINAL' ? 'final' : 'conditional'
    return {
      id: field.id, name: field.name, kind: field.kind, mandatory, ...(field.condition ? { condition: field.condition } : {}), value,
      status: value !== undefined ? 'FILLED' : isMandatoryAt(field, stage) ? 'MISSING' : 'TO_CHECK', ...(field.options ? { allowed: field.options } : {}),
    }
  })
}

export interface NotificationJsonInput {
  code: string; label?: string; autorite?: string
  phase: { code: string; label?: string }; echeance: Date | null; soumisLe: Date | null; reference?: string
}
export interface NotificationJson {
  schema: 'acra.incident-notification/1'; notice: string; generatedAt: string
  regime: { code: string; label?: string; authority?: string; phase: string; phaseLabel?: string; deadline: string | null; submittedAt: string | null; reference?: string }
  /** Rubriques de l'art. 33 § 3 du RGPD (régime RGPD_33 seulement) : à compléter par l'entité. */
  rgpd?: Record<string, string | number | boolean | string[]>
  incident: { reference: string; title: string; description?: string; detectedAt?: string; occurredAt?: string; status?: string; eventType?: string; organisation: string; classifiedMajorAt?: string; closedAt?: string; resolutionSummary?: string; rootCause?: string; rootCauseDetail?: string }
}

/** Fichier JSON générique pour un régime autre que DORA (NIS2, CRA, RGPD, SEC 8-K, NYDFS, HIPAA, interne, personnalisé). */
export function buildNotificationJson(inc: DeclarationIncident, n: NotificationJsonInput, ctx: DeclarationContext, declaration: Declaration = {}): NotificationJson {
  return {
    schema: 'acra.incident-notification/1', generatedAt: ctx.now.toISOString(),
    notice: 'Aide à la déclaration : le contenu, le canal et le format de dépôt sont fixés par l’autorité ou le contrat concernés ; ce fichier n’a pas été transmis.',
    regime: { code: n.code, ...(n.label ? { label: n.label } : {}), ...(n.autorite ? { authority: n.autorite } : {}), phase: n.phase.code, ...(n.phase.label ? { phaseLabel: n.phase.label } : {}),
      deadline: iso(n.echeance) ?? null, submittedAt: iso(n.soumisLe) ?? null, ...(n.reference ? { reference: n.reference } : {}) },
    incident: {
      reference: `ACRA-${inc.id}`, title: inc.intitule, ...(inc.description ? { description: inc.description } : {}),
      ...(iso(inc.dateDetection) ? { detectedAt: iso(inc.dateDetection) } : {}), ...(iso(inc.dateSurvenance) ? { occurredAt: iso(inc.dateSurvenance) } : {}),
      ...(inc.statut ? { status: inc.statut } : {}), ...(inc.typeEvenement ? { eventType: inc.typeEvenement } : {}), organisation: ctx.organisationNom,
      ...(iso(inc.doraClasseMajeurLe) ? { classifiedMajorAt: iso(inc.doraClasseMajeurLe) } : {}), ...(iso(inc.clotureLe) ? { closedAt: iso(inc.clotureLe) } : {}),
      ...(inc.clotureCommentaire ? { resolutionSummary: inc.clotureCommentaire } : {}), ...(inc.causeRacine ? { rootCause: inc.causeRacine } : {}), ...(inc.causeDetail ? { rootCauseDetail: inc.causeDetail } : {}),
    },
    ...(n.code === 'RGPD_33' ? { rgpd: Object.fromEntries(RGPD_FIELDS.map(f => [f.key, declaration[f.id] ?? (f.key === 'nature' ? inc.description ?? undefined : undefined)]).filter(([, v]) => v !== undefined)) } : {}),
  }
}
